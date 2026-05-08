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
    const data = await cached(`standings:${league}`, () =>
      getJSON(`${ESPN_V2}/${league}/standings`)
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

    const profile = await cached(
      `profile:${league}:${teamId}`,
      async () => {
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
      },
      TTL_PROFILE
    );

    res.json(profile);
  } catch (e: any) {
    console.error('profile', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- CHAT (Groq, grounded) ----------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], context = {} } = req.body || {};
    const standings = (context.standings || []).slice(0, 6);
    const headlines = (context.headlines || []).slice(0, 6);
    const form = context.form || [];

    const standingsBlock = standings.length
      ? standings
          .map(
            (s: any) =>
              `${s.rank}. ${s.team} — ${s.points}pts (${s.wins}W ${s.draws}D ${s.losses}L, GD ${s.gd >= 0 ? '+' : ''}${s.gd})`
          )
          .join('\n')
      : 'unavailable';

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

    const positionLine = context.standingSummary
      ? `Current position: ${context.standingSummary}.`
      : '';

    const sys = `You are TOUCHLINE, a sharp, friendly football assistant.
The user follows ${context.team || 'their team'} in ${context.league || 'their league'}.

GROUNDING DATA (only source of truth — do not invent specifics beyond this):
${positionLine}
Recent form (most recent first): ${formBlock}
Top of table:
${standingsBlock}
Latest headlines:
${headlineBlock}

RULES
- Stay grounded in the data above. If a question needs data not provided (e.g., a player stat, an exact transfer fee, an upcoming fixture date), say "I don't have that exact data right now" and offer what you DO know.
- Be concise: 2–4 short sentences by default. No markdown headers, no bullet lists unless explicitly asked.
- Tone: confident, casual, sporty — like a mate at the pub who actually knows football.
- If the user asks something off-topic (non-football), gently redirect.
- Never fabricate scorelines, dates, lineups, or transfer rumours.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.45,
      max_tokens: 500,
      messages: [{ role: 'system', content: sys }, ...messages],
    });

    res.json({
      reply: completion.choices[0]?.message?.content ?? '',
    });
  } catch (e: any) {
    console.error('chat', e.message);
    res.status(500).json({ error: e.message });
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[touchline] api on :${PORT}`);
});
