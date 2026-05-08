import express from 'express';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '1mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer';

const TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: any; ts: number }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T;
  const data = await fn();
  cache.set(key, { data, ts: Date.now() });
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
