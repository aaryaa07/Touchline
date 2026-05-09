import express from 'express';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '1mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer';

const TTL = 5 * 60 * 1000;
const TTL_PROFILE = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: any; ts: number; ttl: number }>();

async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = TTL
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data as T;
  const data = await fn();
  // Don't cache null/undefined or empty strings/arrays — likely a transient
  // failure (rate limit, network) we'd want to retry on the next call.
  const isEmptyish =
    data == null ||
    (typeof data === 'string' && data.length === 0) ||
    (Array.isArray(data) && data.length === 0);
  if (!isEmptyish) cache.set(key, { data, ts: Date.now(), ttl });
  return data;
}

async function getJSON(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; touchline/1.0)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}

// ---------- TEAMS in a league ----------
app.get('/api/leagues/:league/teams', async (req, res) => {
  try {
    const { league } = req.params;
    const data = await cached(`teams:${league}`, () =>
      getJSON(`${ESPN}/${league}/teams?limit=50`)
    );
    const raw = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
    const teams = raw
      .map((t: any) => t.team)
      .map((team: any) => ({
        id: String(team.id),
        name: team.displayName,
        shortName: team.shortDisplayName,
        nickname: team.name,
        abbreviation: team.abbreviation,
        slug: team.slug,
        logo:
          team.logos?.[0]?.href ||
          `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`,
        color: team.color ? `#${team.color}` : null,
        alternateColor: team.alternateColor ? `#${team.alternateColor}` : null,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    res.json(teams);
  } catch (e: any) {
    console.error('teams', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- STANDINGS ----------
app.get('/api/leagues/:league/standings', async (req, res) => {
  try {
    const { league } = req.params;
    const seasonRaw = (req.query.season || '').toString();
    const season = /^\d{4}$/.test(seasonRaw) ? seasonRaw : '';
    const seasonQS = season ? `?season=${season}` : '';
    const data = await cached(
      `standings:${league}:${season || 'current'}`,
      () => getJSON(`${ESPN_V2}/${league}/standings${seasonQS}`)
    );
    const entries =
      data.children?.[0]?.standings?.entries ??
      data.standings?.entries ??
      [];
    const standings = entries.map((e: any) => {
      const stats: Record<string, any> = Object.fromEntries(
        (e.stats || []).map((s: any) => [s.name, s.value ?? s.displayValue])
      );
      return {
        rank: Number(stats.rank) || 0,
        teamId: String(e.team.id),
        team: e.team.displayName,
        shortName: e.team.shortDisplayName,
        logo: e.team.logos?.[0]?.href,
        played: Number(stats.gamesPlayed) || 0,
        wins: Number(stats.wins) || 0,
        draws: Number(stats.ties) || 0,
        losses: Number(stats.losses) || 0,
        gd: Number(stats.pointDifferential) || 0,
        points: Number(stats.points) || 0,
      };
    });
    standings.sort((a: any, b: any) => a.rank - b.rank);
    res.json(standings);
  } catch (e: any) {
    console.error('standings', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- LEAGUE CONTEXT (upcoming + recent fixtures) ----------
function yyyymmdd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

app.get('/api/leagues/:league/context', async (req, res) => {
  try {
    const { league } = req.params;
    const data = await cached(`context:${league}`, async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10 * 86400_000);
      const future = new Date(now.getTime() + 21 * 86400_000);
      const range = `${yyyymmdd(past)}-${yyyymmdd(future)}`;
      return getJSON(`${ESPN}/${league}/scoreboard?dates=${range}`);
    });

    const events = (data as any).events || [];
    type Match = {
      id: string;
      date: string;
      home: string;
      homeShort?: string;
      homeScore: number | null;
      away: string;
      awayShort?: string;
      awayScore: number | null;
      state: 'pre' | 'in' | 'post' | 'unknown';
      status: string;
      competition?: string;
    };

    const matches: Match[] = events.map((e: any) => {
      const comp = e.competitions?.[0];
      const competitors = comp?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || {};
      const state = (comp?.status?.type?.state || 'unknown') as Match['state'];
      const completed = !!comp?.status?.type?.completed;
      const parseScore = (c: any) => {
        const s = c?.score?.value ?? c?.score?.displayValue ?? c?.score;
        const n = parseInt(String(s ?? ''), 10);
        return Number.isFinite(n) ? n : null;
      };
      return {
        id: String(e.id),
        date: e.date,
        home: home.team?.displayName,
        homeShort: home.team?.shortDisplayName,
        homeScore: completed ? parseScore(home) : null,
        away: away.team?.displayName,
        awayShort: away.team?.shortDisplayName,
        awayScore: completed ? parseScore(away) : null,
        state,
        status: comp?.status?.type?.shortDetail || comp?.status?.type?.description || '',
        competition: e.season?.displayName,
      };
    });

    const nowMs = Date.now();
    const recent = matches
      .filter(
        (m) =>
          m.state === 'post' &&
          new Date(m.date).getTime() <= nowMs &&
          m.home &&
          m.away
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    const upcoming = matches
      .filter(
        (m) =>
          (m.state === 'pre' || m.state === 'in') &&
          new Date(m.date).getTime() >= nowMs - 6 * 3600_000 && // include matches in progress
          m.home &&
          m.away
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 12);

    res.json({ upcoming, recent });
  } catch (e: any) {
    console.error('context', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- TEAM DETAILS ----------
app.get('/api/teams/:league/:teamId', async (req, res) => {
  try {
    const { league, teamId } = req.params;
    const data = await cached(`team:${league}:${teamId}`, () =>
      getJSON(`${ESPN}/${league}/teams/${teamId}`)
    );
    const t = data.team;
    res.json({
      id: String(t.id),
      name: t.displayName,
      shortName: t.shortDisplayName,
      nickname: t.name,
      abbreviation: t.abbreviation,
      logo: t.logos?.[0]?.href,
      color: t.color ? `#${t.color}` : null,
      alternateColor: t.alternateColor ? `#${t.alternateColor}` : null,
      record: t.record?.items?.[0]?.summary,
      standingSummary: t.standingSummary,
      venue: t.franchise?.venue?.fullName,
    });
  } catch (e: any) {
    console.error('team', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- TEAM FORM (last 5 completed) ----------
app.get('/api/teams/:league/:teamId/form', async (req, res) => {
  try {
    const { league, teamId } = req.params;
    const data = await cached(`schedule:${league}:${teamId}`, () =>
      getJSON(`${ESPN}/${league}/teams/${teamId}/schedule`)
    );
    const events = data.events || data.team?.events || [];
    const past = events
      .filter(
        (e: any) =>
          e.competitions?.[0]?.status?.type?.completed ||
          e.status?.type?.completed
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 5)
      .map((e: any) => {
        const comp = e.competitions?.[0];
        const competitors = comp?.competitors || [];
        const us = competitors.find((c: any) => String(c.team?.id) === teamId);
        const them = competitors.find(
          (c: any) => String(c.team?.id) !== teamId
        );
        const usScore = parseInt(
          us?.score?.value ?? us?.score?.displayValue ?? us?.score ?? '0',
          10
        );
        const themScore = parseInt(
          them?.score?.value ??
            them?.score?.displayValue ??
            them?.score ??
            '0',
          10
        );
        let result: 'W' | 'D' | 'L' = 'D';
        if (usScore > themScore) result = 'W';
        else if (usScore < themScore) result = 'L';
        return {
          id: e.id,
          date: e.date,
          opponent: them?.team?.displayName,
          opponentShort: them?.team?.shortDisplayName,
          opponentLogo:
            them?.team?.logos?.[0]?.href || them?.team?.logo,
          home: us?.homeAway === 'home',
          ourScore: usScore,
          theirScore: themScore,
          result,
          competition:
            comp?.notes?.[0]?.headline ||
            e.season?.displayName ||
            e.seasonType?.name ||
            'League',
        };
      });
    res.json(past);
  } catch (e: any) {
    console.error('form', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- NEWS (league or team-filtered) ----------
app.get('/api/leagues/:league/news', async (req, res) => {
  try {
    const { league } = req.params;
    const teamFilter = ((req.query.team as string) || '').toLowerCase();
    const teamWords = teamFilter
      .split(/\s+/)
      .filter((w) => w.length >= 4); // avoid matching "city", "the"
    const data = await cached(`news:${league}`, () =>
      getJSON(`${ESPN}/${league}/news?limit=30`)
    );
    let articles = (data.articles || []).map((a: any) => ({
      id: String(a.id ?? a.dataSourceIdentifier ?? Math.random()),
      headline: a.headline,
      description: a.description,
      published: a.published,
      type: a.type,
      image:
        a.images?.find((i: any) => i.url)?.url ||
        a.images?.[0]?.url ||
        null,
      link: a.links?.web?.href,
      categories: (a.categories || []).map((c: any) => c.description).filter(Boolean),
    }));
    if (teamFilter && teamWords.length) {
      articles = articles.filter((a: any) => {
        const hay = `${a.headline || ''} ${a.description || ''} ${(a.categories || []).join(' ')}`.toLowerCase();
        return teamWords.some((w) => hay.includes(w));
      });
    }
    res.json(articles);
  } catch (e: any) {
    console.error('news', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- CLUB PROFILE (Wikipedia + Wikidata) ----------
const WIKI_UA = 'touchline/1.0 (football-news-app)';

async function wikiOpenSearch(query: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
    query
  )}&limit=5&namespace=0&format=json`;
  const data = await wikiFetch(url, `wikiOpenSearch("${query}")`);
  return (data?.[1] || []) as string[];
}

const LEAGUE_COUNTRY: Record<string, string[]> = {
  'eng.1': ['english', 'england', 'british', 'united kingdom'],
  'esp.1': ['spanish', 'spain'],
  'ger.1': ['german', 'germany'],
  'ita.1': ['italian', 'italy'],
  'fra.1': ['french', 'france'],
};

// Titles we never want to pick (youth, women, reserves, supporter pages, etc.)
const EXCLUDE_TITLE =
  /(youth|reserve|reserves|women|academy|under[-\s]?\d+|\bii\b|\bb\b|supporters|in international|history of|seasons|records|stadium|ground)/i;

// Cached helpers to avoid hammering Wikipedia
const wikiSummaryCached = (title: string) =>
  cached(`wiki:summary:${title}`, () => wikiSummary(title), TTL_PROFILE);
const wikiOpenSearchCached = (q: string) =>
  cached(`wiki:search:${q}`, () => wikiOpenSearch(q), TTL_PROFILE);

async function findClubArticle(
  teamName: string,
  countryHints?: string[]
): Promise<string | null> {
  const queries = [
    teamName,
    `${teamName} F.C.`,
    `FC ${teamName}`,
    `${teamName} football club`,
  ];
  const candidates: string[] = [];
  for (const q of queries) {
    const titles = await wikiOpenSearchCached(q);
    for (const t of titles) if (!candidates.includes(t)) candidates.push(t);
  }

  let best = { title: '', score: -100 };
  for (const t of candidates.slice(0, 8)) {
    if (EXCLUDE_TITLE.test(t)) continue; // skip youth/women/etc. without spending a fetch
    const summary = await wikiSummaryCached(t).catch(() => null);
    if (!summary) continue;
    const desc = (summary.description || '').toLowerCase();
    // Hard gate: article must look like a football entity. Cities, regions,
    // people, etc. don't get scored at all.
    if (!/(football|soccer|association|club|sports? club)/i.test(desc)) continue;
    if (/(disambiguation|may refer to)/i.test(desc)) continue;

    let score = 0;
    if (/football club|soccer club|association football/i.test(desc)) score += 10;
    else if (/football|soccer/i.test(desc)) score += 4;
    if (countryHints?.some((h) => desc.includes(h))) score += 8;
    if (t.toLowerCase().startsWith(teamName.toLowerCase())) score += 4;
    if (t.toLowerCase() === teamName.toLowerCase()) score += 2;
    if (/\bF\.C\.|\bFC\b/.test(t)) score += 1;
    if (score > best.score) best = { title: t, score };
    if (score >= 18) return t; // strong match — stop early
  }
  if (best.score >= 10) return best.title;
  return null; // signal "couldn't find a real club article"
}

async function wikiSummary(title: string): Promise<any> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_')
  )}`;
  return wikiFetch(url, `wikiSummary(${title})`);
}

async function wikiSectionsRaw(title: string): Promise<any[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&page=${encodeURIComponent(title)}&prop=sections&redirects=1`;
  const d = await wikiFetch(url, `wikiSections(${title})`);
  return d?.parse?.sections || [];
}

const wikiSections = (title: string) =>
  cached(`wiki:sections:${title}`, () => wikiSectionsRaw(title), TTL_PROFILE);

async function wikiFetch(url: string, label: string): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
      if (r.status === 429) {
        const wait = 1500 * Math.pow(1.6, attempt);
        console.warn(
          `[${label}] 429, retrying in ${Math.round(wait)}ms (attempt ${attempt + 1})`
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!r.ok) {
        console.warn(`[${label}] HTTP ${r.status}`);
        return null;
      }
      return r.json();
    } catch (e: any) {
      console.warn(`[${label}] threw: ${e.message}`);
      return null;
    }
  }
  return null;
}

async function wikiSectionHtmlRaw(
  title: string,
  section: number | string
): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&page=${encodeURIComponent(
    title
  )}&prop=text&section=${section}&redirects=1`;
  const d = await wikiFetch(url, `wikiSectionHtml(${title}#${section})`);
  if (d?.error) {
    console.warn(`[wikiSectionHtml] API error "${title}": ${d.error.info}`);
    return '';
  }
  return d?.parse?.text?.['*'] || '';
}

const wikiSectionHtml = (title: string, section: number | string) =>
  cached(
    `wiki:section:${title}:${section}`,
    () => wikiSectionHtmlRaw(title, section),
    TTL_PROFILE
  );

function parseInfobox(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const out: Record<string, string> = {};
  $('table.infobox')
    .first()
    .find('tr')
    .each((_, tr) => {
      const $tr = $(tr);
      const th = $tr.find('th').first();
      const td = $tr.find('td').first();
      if (!th.length || !td.length) return;
      const label = th.text().trim().toLowerCase();
      td.find('sup.reference, sup.noprint').remove();
      let value = td.text();
      value = value.replace(/\[\s*\d+\s*\]/g, '').replace(/\s+/g, ' ').trim();
      if (label && value && label.length < 40) out[label] = value;
    });
  return out;
}

function parseHonours(
  html: string
): Array<{ category: string; competition: string; count: number }> {
  const $ = cheerio.load(html);
  const out: Array<{ category: string; competition: string; count: number }> = [];

  $('table.wikitable').each((_, tbl) => {
    const $tbl = $(tbl);
    const headerCells = $tbl
      .find('tr')
      .first()
      .find('th')
      .map((_, th) => $(th).text().trim().toLowerCase())
      .get();
    const isHonoursTable =
      headerCells.some((h) => h.includes('competition')) &&
      headerCells.some((h) => h.includes('title'));
    if (!isHonoursTable) return;

    let currentCategory = '';
    $tbl.find('tr').each((idx, tr) => {
      if (idx === 0) return; // skip header
      const $tr = $(tr);
      $tr.find('sup.reference, sup.noprint').remove();
      const cells = $tr
        .find('th, td')
        .map((_, td) =>
          $(td).text().replace(/\[\s*\d+\s*\]/g, '').replace(/\s+/g, ' ').trim()
        )
        .get();
      if (cells.length === 0) return;

      let category = currentCategory;
      let competition = '';
      let countStr = '';

      if (cells.length >= 4) {
        category = cells[0];
        currentCategory = category;
        competition = cells[1];
        countStr = cells[2];
      } else if (cells.length === 3) {
        competition = cells[0];
        countStr = cells[1];
      } else {
        return;
      }

      const num = parseInt((countStr.match(/\d+/) || ['0'])[0], 10);
      if (
        num > 0 &&
        competition &&
        competition.length < 80 &&
        !/^records?$/i.test(competition)
      ) {
        out.push({
          category: category || 'Other',
          competition: competition.replace(/\s*\/\s*/g, ' / '),
          count: num,
        });
      }
    });
  });
  return out;
}

async function wikidataLabels(qids: string[]): Promise<Record<string, string>> {
  if (qids.length === 0) return {};
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join(
    '|'
  )}&format=json&props=labels&languages=en`;
  const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
  if (!r.ok) return {};
  const d: any = await r.json();
  const out: Record<string, string> = {};
  for (const qid of qids)
    out[qid] = d?.entities?.[qid]?.labels?.en?.value || '';
  return out;
}

async function wikidataClaims(qid: string, props: string[]) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&format=json&props=claims&languages=en`;
  const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
  if (!r.ok) return {};
  const d: any = await r.json();
  const claims = d?.entities?.[qid]?.claims || {};
  const out: Record<string, any> = {};
  for (const p of props) {
    const val = claims[p]?.[0]?.mainsnak?.datavalue?.value;
    out[p] = val;
  }
  return out;
}

app.get('/api/teams/:league/:teamId/profile', async (req, res) => {
  try {
    const { league, teamId } = req.params;
    const teamData: any = await cached(`team:${league}:${teamId}`, () =>
      getJSON(`${ESPN}/${league}/teams/${teamId}`)
    );
    const teamName = teamData?.team?.displayName;
    if (!teamName) return res.json(null);

    // Build the profile each call. The expensive bits (wiki summary, section
    // HTML, Wikidata claims) are individually cached for 24h, so a complete
    // build is essentially free once warm. We avoid an outer profile cache so
    // a partial result (trophies missing due to rate limit, etc.) doesn't
    // get pinned for 24h.
    const profile = await (async () => {
        const title = await findClubArticle(
          teamName,
          LEAGUE_COUNTRY[league] || []
        );
        if (!title) return null; // could not confidently resolve a club article

        // Serialize the calls (not Promise.all) so we don't trigger
        // Wikipedia's per-IP rate limiter with simultaneous parse-API hits.
        const summary = await wikiSummaryCached(title).catch(() => null);
        const infoboxHtml = await wikiSectionHtml(title, 0).catch(() => '');
        const sections = await wikiSections(title).catch(() => []);

        const infobox = parseInfobox(infoboxHtml || '');
        const qid = summary?.wikibase_item || null;

        // Parse Honours if present
        let trophies: ReturnType<typeof parseHonours> = [];
        const honoursSec = (sections as any[]).find(
          (s) => /^honou(?:rs|r)s?$/i.test((s.line || '').replace(/<[^>]+>/g, '').trim())
        );
        if (honoursSec) {
          const honoursHtml = await wikiSectionHtml(
            title,
            honoursSec.index
          ).catch(() => '');
          trophies = parseHonours(honoursHtml);
        }

        // Resolve city/country from Wikidata
        let city: string | null = null;
        let country: string | null = null;
        if (qid) {
          const claims = await wikidataClaims(qid, ['P159', 'P17']).catch(
            () => ({}) as any
          );
          const ids: string[] = [];
          if (claims.P159?.id) ids.push(claims.P159.id);
          if (claims.P17?.id) ids.push(claims.P17.id);
          const labels = await wikidataLabels(ids).catch(() => ({}));
          if (claims.P159?.id) city = labels[claims.P159.id] || null;
          if (claims.P17?.id) country = labels[claims.P17.id] || null;
        }

        const foundedMatch = infobox.founded?.match(/(\d{3,4})/);
        const foundedYear = foundedMatch
          ? parseInt(foundedMatch[1], 10)
          : null;

        const capacityMatch = infobox.capacity?.match(/[\d,]+/);
        const capacity = capacityMatch
          ? parseInt(capacityMatch[0].replace(/,/g, ''), 10)
          : null;

        return {
          title,
          wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(
            String(title).replace(/ /g, '_')
          )}`,
          description: summary?.description || '',
          extract: summary?.extract || '',
          founded: foundedYear,
          foundedRaw: infobox.founded || null,
          stadium:
            infobox.ground || infobox.stadium || infobox['home ground'] || null,
          capacity,
          city,
          country,
          owner:
            infobox['owner(s)'] ||
            infobox.owner ||
            infobox.owners ||
            null,
          chairman:
            infobox.chairman ||
            infobox.president ||
            infobox['president(s)'] ||
            null,
          manager:
            infobox.manager ||
            infobox['head coach'] ||
            infobox['manager(s)'] ||
            null,
          trophies,
        };
      })();

    res.json(profile);
  } catch (e: any) {
    console.error('profile', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- LEAGUE LEADERS (Wikipedia season article scrape) ----------
const WIKI_LEAGUE_NAME: Record<string, string> = {
  'eng.1': 'Premier_League',
  'esp.1': 'La_Liga',
  'ger.1': 'Bundesliga',
  'ita.1': 'Serie_A',
  'fra.1': 'Ligue_1',
};

function parseLeadersTable(html: string): {
  rank: number;
  player: string;
  club: string;
  value: number;
}[] {
  const $ = cheerio.load(html);
  const out: { rank: number; player: string; club: string; value: number }[] = [];
  let lastRank = 0;
  let lastValue = 0;

  $('table.wikitable')
    .first()
    .find('tr')
    .each((idx, tr) => {
      if (idx === 0) return; // skip header
      const $tr = $(tr);
      $tr.find('sup, .reference, .flagicon').remove();
      const cells = $tr
        .find('td, th')
        .map((_, c) =>
          $(c)
            .text()
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .get();
      if (cells.length === 0) return;

      let i = 0;
      let rank = lastRank;
      if (cells[i] && /^\d+\.?$/.test(cells[i])) {
        rank = parseInt(cells[i], 10);
        lastRank = rank;
        i++;
      }
      const player = cells[i++] || '';
      const club = cells[i++] || '';
      const valueRaw = cells[i++];

      let value = lastValue;
      if (valueRaw && /\d/.test(valueRaw)) {
        value = parseInt(valueRaw.match(/\d+/)?.[0] || '0', 10);
        lastValue = value;
      }

      if (
        player &&
        player.length < 60 &&
        !/^-+$/.test(player) &&
        rank > 0 &&
        value > 0
      ) {
        out.push({ rank, player, club, value });
      }
    });

  return out.slice(0, 10);
}

app.get('/api/leagues/:league/leaders', async (req, res) => {
  try {
    const { league } = req.params;
    const seasonRaw = (req.query.season || '').toString();
    const season = /^\d{4}$/.test(seasonRaw)
      ? parseInt(seasonRaw, 10)
      : new Date().getFullYear();

    const leagueWiki = WIKI_LEAGUE_NAME[league];
    if (!leagueWiki) {
      return res.json({
        topScorers: [],
        cleanSheets: [],
        season,
        source: 'unsupported league',
      });
    }

    const yearEnd = String(season + 1).slice(-2);
    // en-dash between years (Wikipedia convention)
    const articleTitle = `${season}–${yearEnd}_${leagueWiki}`;

    const data = await cached(
      `leaders:${league}:${season}`,
      async () => {
        const sections = await wikiSections(articleTitle);
        if (!sections || sections.length === 0)
          return { topScorers: [], cleanSheets: [] };

        const findIdx = (pred: (line: string) => boolean) => {
          const s = sections.find((sec: any) =>
            pred((sec.line || '').replace(/<[^>]+>/g, '').toLowerCase().trim())
          );
          return s ? s.index : null;
        };

        const scorerIdx = findIdx((l) => /top.*(scorer|goalscorer)/.test(l));
        const csIdx = findIdx((l) => /clean sheet/.test(l));

        const [scorerHtml, csHtml] = await Promise.all([
          scorerIdx
            ? wikiSectionHtml(articleTitle, scorerIdx)
            : Promise.resolve(''),
          csIdx ? wikiSectionHtml(articleTitle, csIdx) : Promise.resolve(''),
        ]);

        return {
          topScorers: scorerHtml ? parseLeadersTable(scorerHtml) : [],
          cleanSheets: csHtml ? parseLeadersTable(csHtml) : [],
        };
      },
      TTL_PROFILE
    );

    res.json({
      ...data,
      season,
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle)}`,
    });
  } catch (e: any) {
    console.error('leaders', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- AGENT TOOLS (called by Groq during chat) ----------
// Each returns a small JSON payload that the LLM can read. Errors are
// returned in-band so the model can react gracefully rather than throwing.

const TOOL_LEAGUES = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];

async function tool_lookup_team(args: { team_name: string }) {
  const q = (args.team_name || '').toLowerCase().trim();
  if (!q) return { error: 'team_name is required' };
  const hits: any[] = [];
  for (const lg of TOOL_LEAGUES) {
    try {
      const data: any = await cached(`teams:${lg}`, () =>
        getJSON(`${ESPN}/${lg}/teams?limit=50`)
      );
      const list = data?.sports?.[0]?.leagues?.[0]?.teams || [];
      for (const wrap of list) {
        const t = wrap.team;
        const blob =
          `${t.displayName} ${t.shortDisplayName} ${t.name} ${t.abbreviation}`.toLowerCase();
        if (blob.includes(q)) {
          hits.push({
            league_code: lg,
            team_id: String(t.id),
            name: t.displayName,
            shortName: t.shortDisplayName,
            abbreviation: t.abbreviation,
          });
        }
      }
    } catch {
      /* ignore one league failure */
    }
  }
  if (hits.length === 0) return { error: `No team found matching "${args.team_name}"` };
  return { matches: hits.slice(0, 5) };
}

async function tool_get_team_schedule(args: {
  league_code: string;
  team_id: string;
}) {
  const { league_code, team_id } = args;
  if (!league_code || !team_id)
    return { error: 'league_code and team_id are required' };
  const data: any = await cached(`schedule:${league_code}:${team_id}`, () =>
    getJSON(`${ESPN}/${league_code}/teams/${team_id}/schedule`)
  ).catch((e: any) => ({ error: e.message }));
  if (data?.error) return data;

  const events = data.events || [];
  const teamName = data.team?.displayName;
  return {
    team: teamName,
    matches: events.slice(0, 25).map((e: any) => {
      const comp = e.competitions?.[0];
      const competitors = comp?.competitors || [];
      const us = competitors.find((c: any) => String(c.team?.id) === team_id);
      const them = competitors.find(
        (c: any) => String(c.team?.id) !== team_id
      );
      const completed = !!comp?.status?.type?.completed;
      const parseScore = (c: any) => {
        const s = c?.score?.value ?? c?.score?.displayValue ?? c?.score;
        const n = parseInt(String(s ?? ''), 10);
        return Number.isFinite(n) ? n : null;
      };
      return {
        date: e.date,
        opponent: them?.team?.displayName,
        home: us?.homeAway === 'home',
        our_score: completed ? parseScore(us) : null,
        their_score: completed ? parseScore(them) : null,
        completed,
        status: comp?.status?.type?.shortDetail,
        competition: comp?.notes?.[0]?.headline || e.season?.displayName,
      };
    }),
  };
}

async function tool_get_team_roster(args: {
  league_code: string;
  team_id: string;
}) {
  const { league_code, team_id } = args;
  if (!league_code || !team_id)
    return { error: 'league_code and team_id are required' };
  const data: any = await cached(`roster:${league_code}:${team_id}`, () =>
    getJSON(`${ESPN}/${league_code}/teams/${team_id}/roster`)
  ).catch((e: any) => ({ error: e.message }));
  if (data?.error) return data;

  const out: any[] = [];
  const flatten = (arr: any[]) => {
    for (const a of arr) {
      if (a?.items && Array.isArray(a.items)) flatten(a.items);
      else
        out.push({
          name: a.fullName || a.displayName,
          jersey: a.jersey,
          position: a.position?.displayName || a.position?.abbreviation,
          age: a.age,
          nationality: a.citizenship || a.birthPlace?.country,
        });
    }
  };
  flatten(data.athletes || []);
  return {
    team: data.team?.displayName,
    coach: data.coach?.[0]?.firstName
      ? `${data.coach[0].firstName} ${data.coach[0].lastName || ''}`.trim()
      : data.coach?.[0]?.displayName,
    squad_size: out.length,
    players: out.slice(0, 35),
  };
}

async function tool_get_team_standing(args: {
  league_code: string;
  team_id: string;
}) {
  const { league_code, team_id } = args;
  if (!league_code || !team_id)
    return { error: 'league_code and team_id are required' };
  const data: any = await cached(`standings:${league_code}`, () =>
    getJSON(`${ESPN_V2}/${league_code}/standings`)
  ).catch((e: any) => ({ error: e.message }));
  if (data?.error) return data;

  const entries =
    data.children?.[0]?.standings?.entries || data.standings?.entries || [];
  const me = entries.find((e: any) => String(e.team?.id) === team_id);
  if (!me) return { error: 'Team not found in standings' };
  const stats: Record<string, any> = Object.fromEntries(
    (me.stats || []).map((s: any) => [s.name, s.value ?? s.displayValue])
  );
  return {
    team: me.team.displayName,
    rank: Number(stats.rank) || null,
    played: Number(stats.gamesPlayed) || null,
    wins: Number(stats.wins) || null,
    draws: Number(stats.ties) || null,
    losses: Number(stats.losses) || null,
    points: Number(stats.points) || null,
    gd: Number(stats.pointDifferential) || null,
    total_teams: entries.length,
  };
}

const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'lookup_team',
      description:
        'Find a football club by name across the top 5 European leagues (Premier League / La Liga / Bundesliga / Serie A / Ligue 1). Returns league_code + team_id you can pass to other tools. Use this whenever the user asks about a team that is NOT the one they are currently following.',
      parameters: {
        type: 'object',
        properties: {
          team_name: {
            type: 'string',
            description:
              'Team name or partial name, e.g. "Liverpool", "Bayern", "PSG", "Inter".',
          },
        },
        required: ['team_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_team_schedule',
      description:
        "Fetch a team's full season schedule — past results AND upcoming fixtures. Use for: when does X play next, what was the score in their last match, head-to-head lookups (call once per team and compare).",
      parameters: {
        type: 'object',
        properties: {
          league_code: {
            type: 'string',
            description:
              'ESPN league code: eng.1, esp.1, ger.1, ita.1, or fra.1.',
          },
          team_id: { type: 'string', description: 'ESPN team id (string).' },
        },
        required: ['league_code', 'team_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_team_roster',
      description:
        "Get a team's current squad (players, positions, jerseys, ages, nationality) and current head coach. Use for squad / lineup / 'who plays for X' questions.",
      parameters: {
        type: 'object',
        properties: {
          league_code: {
            type: 'string',
            description: 'ESPN league code.',
          },
          team_id: { type: 'string', description: 'ESPN team id.' },
        },
        required: ['league_code', 'team_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_team_standing',
      description:
        "Get a team's current league standing — rank, points, W/D/L, goal difference, total teams in the league. Use when the user asks where a team sits in the table.",
      parameters: {
        type: 'object',
        properties: {
          league_code: {
            type: 'string',
            description: 'ESPN league code.',
          },
          team_id: { type: 'string', description: 'ESPN team id.' },
        },
        required: ['league_code', 'team_id'],
      },
    },
  },
];

async function runTool(name: string, args: any): Promise<any> {
  try {
    if (name === 'lookup_team') return await tool_lookup_team(args);
    if (name === 'get_team_schedule') return await tool_get_team_schedule(args);
    if (name === 'get_team_roster') return await tool_get_team_roster(args);
    if (name === 'get_team_standing')
      return await tool_get_team_standing(args);
    return { error: `Unknown tool: ${name}` };
  } catch (e: any) {
    return { error: e.message || 'tool failed' };
  }
}

// ---------- CHAT (Groq, grounded + agentic tools) ----------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], context = {} } = req.body || {};
    const standings = (context.standings || []).slice(0, 5);
    const headlines = (context.headlines || []).slice(0, 4);
    const form = context.form || [];

    const standingsBlock = standings.length
      ? standings
          .map(
            (s: any) =>
              `${s.rank}. ${s.team} — ${s.points}pts (${s.wins}W ${s.draws}D ${s.losses}L, GD ${s.gd >= 0 ? '+' : ''}${s.gd})`
          )
          .join('\n')
      : 'unavailable';

    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toUTCString().replace(/ \d\d:\d\d:\d\d GMT/, '').trim();
    };

    const upcomingFixtures = (context.upcomingFixtures || []).slice(0, 10);
    const recentResults = (context.recentResults || []).slice(0, 10);

    const fixturesBlock = upcomingFixtures.length
      ? upcomingFixtures
          .map((m: any) => `${fmtDate(m.date)}: ${m.home} vs ${m.away}`)
          .join('\n')
      : 'no upcoming fixtures loaded';

    const resultsBlock = recentResults.length
      ? recentResults
          .map(
            (m: any) =>
              `${fmtDate(m.date)}: ${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`
          )
          .join('\n')
      : 'no recent league results loaded';

    const formBlock = form.length
      ? form
          .map(
            (f: any) =>
              `${f.result} ${f.home ? 'vs' : '@'} ${f.opponent} ${f.ourScore}-${f.theirScore}`
          )
          .join(' | ')
      : 'unavailable';

    const headlineBlock = headlines.length
      ? headlines.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')
      : 'no recent headlines provided';

    const topScorers = (context.topScorers || []).slice(0, 8);
    const cleanSheets = (context.cleanSheets || []).slice(0, 6);
    const scorersBlock = topScorers.length
      ? topScorers
          .map((s: any) => `${s.rank}. ${s.player} (${s.club}) — ${s.value} goals`)
          .join('\n')
      : 'unavailable';
    const cleanSheetsBlock = cleanSheets.length
      ? cleanSheets
          .map((s: any) => `${s.rank}. ${s.player} (${s.club}) — ${s.value} CS`)
          .join('\n')
      : 'unavailable';

    const seasonNum = Number(context.season) || new Date().getFullYear();
    const seasonLabel = `${String(seasonNum).slice(-2)}/${String(seasonNum + 1).slice(-2)}`;
    const isCurrent = seasonNum === new Date().getFullYear();
    const seasonNote = isCurrent
      ? `Current season is ${seasonLabel}. The grounding data below is live.`
      : `THE USER IS VIEWING A HISTORICAL SEASON: ${seasonLabel}. Standings, top scorers, clean sheets below reflect that year. Form, ownership and headlines remain CURRENT (today's data) — make this clear if it matters to your answer.`;

    const positionLine = context.standingSummary
      ? `Current position: ${context.standingSummary}.`
      : '';

    const userTeam = context.team || 'their team';
    const userLeague = context.league || 'their league';
    const idHint =
      context.teamId && context.leagueCode
        ? `When calling tools for ${userTeam} specifically, use league_code="${context.leagueCode}" and team_id="${context.teamId}" — no lookup needed for them.`
        : '';

    const sys = `You are TOUCHLINE, a sharp, friendly football assistant.
The user follows ${userTeam} in ${userLeague}.
${seasonNote}
${idHint}

GROUNDING DATA (use first; treat as fresh, accurate, from ESPN/Wikipedia):
${positionLine}
${context.team || 'Their team'}'s recent form (most recent first): ${formBlock}
Top of table${isCurrent ? '' : ` (${seasonLabel})`}:
${standingsBlock}
Top scorers${isCurrent ? '' : ` (${seasonLabel})`}:
${scorersBlock}
Most clean sheets${isCurrent ? '' : ` (${seasonLabel})`}:
${cleanSheetsBlock}
Recent results across the league (last ~10 days, live):
${resultsBlock}
Upcoming fixtures in the league (next ~3 weeks, live):
${fixturesBlock}
Latest headlines (live):
${headlineBlock}

TOOLS (call when grounding data isn't enough):
- lookup_team(team_name) — find ANY team in the top 5 leagues, returns league_code + team_id
- get_team_schedule(league_code, team_id) — full season schedule for a team
- get_team_roster(league_code, team_id) — current squad + coach
- get_team_standing(league_code, team_id) — current league position
Call them when the question is about a team OUTSIDE the user's current view, or about squad / specific past matches / detailed standings the grounding data doesn't cover. To answer cross-team questions (e.g. "is Liverpool playing this weekend?"), call lookup_team first, then the relevant fetcher. Don't call tools for what the grounding data already shows.

STYLE
- Concise: 2–4 short sentences by default. No markdown headers, bullets only when explicitly asked.
- Confident, casual, sporty tone — like a mate at the pub who actually knows football.
- Never fabricate scorelines, dates, lineups, or transfer rumours. If a tool fails or data isn't found, say "I couldn't pull that up right now."
- Off-topic (non-football) → gently redirect.`;

    type AnyMsg = { role: string; content?: any; tool_calls?: any; tool_call_id?: string };
    const convo: AnyMsg[] = [{ role: 'system', content: sys }, ...messages];
    const toolsUsed: { name: string; args: any }[] = [];
    let final = '';

    // Translate any Groq SDK error into a friendly message the user can read,
    // so the chat panel never shows raw HTTP 5xx. Status comes from the SDK.
    const friendlyFromGroqError = (e: any): string => {
      const status = e?.status || e?.response?.status;
      if (status === 429) {
        return "I'm being rate-limited by the model right now — give me ten seconds and ask again.";
      }
      if (status === 401 || status === 403) {
        return "The AI key doesn't seem to be authorising — let the dev know.";
      }
      if (status && status >= 500) {
        return 'Groq took a beat off. Try that again in a second.';
      }
      if (/timeout|network|fetch failed/i.test(e?.message || '')) {
        return "Couldn't reach the AI just now. One more time?";
      }
      return "Hit a snag answering that. Try rephrasing?";
    };

    for (let iter = 0; iter < 4; iter++) {
      let completion;
      try {
        completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.4,
          max_tokens: 600,
          messages: convo as any,
          tools: AGENT_TOOLS as any,
          tool_choice: 'auto',
        });
      } catch (e: any) {
        console.warn(`[chat] groq error iter=${iter}: ${e?.status || ''} ${e?.message}`);
        final = friendlyFromGroqError(e);
        break;
      }
      const msg = completion.choices[0]?.message;
      if (!msg) break;
      // Push assistant message back into conversation (preserve tool_calls)
      convo.push({
        role: 'assistant',
        content: msg.content ?? '',
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      });

      const calls = msg.tool_calls || [];
      if (calls.length === 0) {
        final = msg.content ?? '';
        break;
      }

      // Execute every tool call, append results
      for (const tc of calls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          /* keep empty */
        }
        const result = await runTool(tc.function.name, args);
        toolsUsed.push({ name: tc.function.name, args });
        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000), // safety cap
        });
      }
    }

    if (!final) {
      final = "I couldn't pull that one up — could you rephrase?";
    }

    res.json({ reply: final, toolsUsed });
  } catch (e: any) {
    console.error('chat', e.message);
    // Always return 200 with a graceful message — the chat UI shouldn't
    // surface raw HTTP errors to the user.
    res.json({
      reply: "Something hiccupped on my side — give me a second and try again.",
      toolsUsed: [],
    });
  }
});

// In production (after `npm run build`), serve the SPA from dist/
const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[touchline] serving SPA from ${distDir}`);
}

// ---------- BOOT: warm the teams index ----------
// We pre-populate the in-memory cache with all 5 leagues' team rosters so
// the agent's `lookup_team` tool — which already reads from this cache —
// answers from local memory on the first call instead of fanning out 5
// HTTP requests to ESPN. This effectively turns the cache into a hot
// "teams index dataset" without an extra storage layer or persistence.
async function warmTeamsIndex() {
  const start = Date.now();
  await Promise.all(
    TOOL_LEAGUES.map((lg) =>
      cached(`teams:${lg}`, () => getJSON(`${ESPN}/${lg}/teams?limit=50`)).catch(
        (e: any) => console.warn(`[warm] ${lg} failed: ${e.message}`)
      )
    )
  );
  // Count what landed
  let total = 0;
  for (const lg of TOOL_LEAGUES) {
    const data: any = cache.get(`teams:${lg}`)?.data;
    total += data?.sports?.[0]?.leagues?.[0]?.teams?.length || 0;
  }
  console.log(
    `[touchline] teams index warmed: ${total} clubs across ${TOOL_LEAGUES.length} leagues (${Date.now() - start}ms)`
  );
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[touchline] api on :${PORT}`);
  warmTeamsIndex().catch(() => {});
});
