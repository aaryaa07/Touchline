# Application Flow

> How Touchline turns a league pick into a live, AI-aware dashboard. This document is for anyone (developer, reviewer, curious user) who wants to understand exactly **where each piece of data on screen comes from**.

---

## TL;DR

Touchline mixes three kinds of data, and the distinction matters:

| Kind | Refresh cadence | Source | Trust |
| --- | --- | --- | --- |
| **Static** — committed in the repo | Only when code changes | The repo | 100% — we wrote it |
| **Dynamic** — fetched on demand | Every 5 minutes (cached) | ESPN's public JSON endpoints | High — official feeds |
| **AI-generated** — written on demand | Per chat message | Groq LLM, **grounded** in the dynamic data above | Conditional — only as good as the context we feed it |

The whole architecture revolves around keeping the AI honest: the chatbot never sees the open internet — it only sees what the dynamic layer just fetched, plus the user's question.

---

## What we mean by "static"

Static data is **anything baked into the source code**. It changes only when a developer ships a new build. Touchline's static data is small and intentional — it's the *shape* of the app, not the *content*.

### The static layer

| What | Where | Why static |
| --- | --- | --- |
| **5 league records** (Premier League, La Liga, Bundesliga, Serie A, Ligue 1) — name, country, ESPN league code (`eng.1`, `esp.1`, …), tagline, theme colors, gradient pattern | [`src/data/leagues.ts`](src/data/leagues.ts) | These don't change. The PL is always `eng.1` to ESPN. The brand purple (#3D195B) is always its purple. Burning a network call on this would be wasteful. |
| **App copy** — headings, eyebrow labels, sample chat prompts, footer | Components themselves | UI strings; baked. |
| **Magazine theme** — Anton + Inter fonts, grain SVG, rounded card system | [`src/index.css`](src/index.css), [`index.html`](index.html) | Pure design system. |
| **Optional CSV standings** | [`data/*.csv`](data/) | Shipped as a fallback if ESPN is unreachable. **Currently unused at runtime** — the dynamic layer covers it. |

> **Mental model:** static data is the stage. It tells the app what leagues exist and what they should *look like* — but never what's actually happening in football right now.

---

## What we mean by "dynamic"

Dynamic data is **anything fetched at runtime**. The user sees today's standings, today's news, today's last-five — none of it lived in the repo five minutes ago.

All dynamic fetches go through **our own Express server**, never browser → ESPN directly. Three reasons:

1. **CORS** — ESPN doesn't set permissive headers; the browser would block it.
2. **Caching** — the server keeps a 5-minute in-memory cache so 10 users picking Arsenal hit ESPN once, not ten times.
3. **Shape control** — we trim ESPN's verbose JSON to a clean schema before the React app sees it.

### The dynamic layer (data flow)

```
React component
      │
      ▼
/api/<route>  ───► Express (server/index.ts)
                       │
                       ▼
              5-minute cache hit?
                  │           │
                 yes          no
                  │           │
                  │           ▼
                  │    fetch ESPN JSON
                  │           │
                  │    normalize shape
                  │           │
                  ▼           ▼
              return cleaned JSON
```

### Endpoints, in plain English

| Endpoint | What it gives the UI | Upstream we hit | How fresh |
| --- | --- | --- | --- |
| `GET /api/leagues/:league/teams` | All clubs in the league with crests + brand colors. Used to render the **Team Picker** grid. | `site.api.espn.com/.../{league}/teams` | 5 min cache |
| `GET /api/leagues/:league/standings` | Full league table — rank, P/W/D/L, GD, points, logos. Used for the **League Table** widget and the chatbot's grounding context. | `site.api.espn.com/apis/v2/.../standings` | 5 min cache |
| `GET /api/teams/:league/:teamId` | One club's metadata — record, position summary, venue. Used in the **dashboard hero**. | `site.api.espn.com/.../teams/{id}` | 5 min cache |
| `GET /api/teams/:league/:teamId/form` | The last 5 completed matches, sorted newest-first, with W/D/L, opponent, score. Used by **FormStrip** and as chatbot context. | `site.api.espn.com/.../teams/{id}/schedule` (we filter for completed events) | 5 min cache |
| `GET /api/leagues/:league/news` | League-wide news. With `?team=Arsenal`, headlines/descriptions are filtered by team words ≥4 chars. Used in **NewsFeed**. | `site.api.espn.com/.../news` | 5 min cache |

### What the server does *not* do

- It does **not** scrape HTML. ESPN's public JSON is enough.
- It does **not** persist anything. Cache is in-memory; restarts wipe it.
- It does **not** call the AI on these routes. They are pure data.

---

## What we mean by "AI-generated"

AI-generated content is **prose written by a model on demand** — only the chatbot. Everything else on screen is real data, untouched by an LLM.

The chatbot is the *only* surface where AI text appears. It's powered by:

- **Provider:** Groq Cloud
- **Model:** `llama-3.3-70b-versatile`
- **Endpoint:** `POST /api/chat` (server-side; the API key never reaches the browser)
- **Temperature:** 0.45 — leaning toward consistent, factual replies
- **Token cap:** 500 — keeps answers tight and pub-conversation-sized

### The grounding model — why the AI doesn't make things up

Most "AI sports apps" let the model hallucinate scorelines because they ask it to *remember* football. Touchline does the opposite: **every chat call carries a fresh snapshot of the user's data**, and the system prompt forbids the model from going beyond it.

When you send a message, the server builds this system prompt on the fly:

```
You are TOUCHLINE, a sharp, friendly football assistant.
The user follows {team} in {league}.

GROUNDING DATA (only source of truth — do not invent specifics beyond this):
Current position: {standingSummary}
Recent form (most recent first): W vs Fulham 3-0 | W vs Newcastle 1-0 | …
Top of table:
  1. Arsenal — 76pts (23W 7D 5L, GD +41)
  2. Manchester City — 71pts …
Latest headlines:
  1. {headline 1}
  2. {headline 2}
  …

RULES
- Stay grounded in the data above. If a question needs data not provided
  (e.g., a player stat, an exact transfer fee, an upcoming fixture date),
  say "I don't have that exact data right now."
- Be concise: 2–4 short sentences by default.
- Tone: confident, casual, sporty.
- Never fabricate scorelines, dates, lineups, or transfer rumours.
```

That snapshot — standings (top 6), form (5 games), headlines (top 6) — is exactly what's already on screen. So:

- **In scope:** "Recap the last five." "Are we trending up?" "Who's the threat in the table?" → answered from real data.
- **Out of scope:** "What did Saka score against Spurs in 2018?" "What's Arteta's salary?" → the model answers "I don't have that exact data right now" instead of guessing.

This makes the AI a *reader* of the dashboard, not a *replacer* of the data layer.

### What gets sent to Groq, exactly

The browser sends:

```json
POST /api/chat
{
  "messages": [
    { "role": "user", "content": "How are we trending?" }
  ],
  "context": {
    "team": "Arsenal",
    "league": "Premier League",
    "standingSummary": "1st in English Premier League",
    "form": [ /* 5 game objects */ ],
    "standings": [ /* full table */ ],
    "headlines": [ /* up to 6 strings */ ]
  }
}
```

The server then builds the system prompt above and posts to Groq. The user's API key stays server-side.

---

## End-to-end walkthrough: "I want Arsenal news"

Here's exactly what happens when a user picks Premier League → Arsenal and asks the bot a question.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. App boot                                                          │
│    • LeaguePicker renders 5 cards from src/data/leagues.ts (STATIC). │
└──────────────────────────────────────────────────────────────────────┘
                          │  user clicks Premier League
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. Team picker                                                       │
│    • TeamPicker fires GET /api/leagues/eng.1/teams (DYNAMIC).        │
│    • Server checks cache → miss → calls ESPN → caches → returns 20.  │
│    • Crests render from a.espncdn.com.                               │
└──────────────────────────────────────────────────────────────────────┘
                          │  user clicks Arsenal
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. Dashboard mount                                                   │
│    • In parallel:                                                    │
│      → GET /api/teams/eng.1/359        (record, position)            │
│      → GET /api/teams/eng.1/359/form   (last 5 results)              │
│      → GET /api/leagues/eng.1/standings (full table)                 │
│      → GET /api/leagues/eng.1/news?team=Arsenal (filtered)           │
│    • Each renders independently as it lands. (DYNAMIC, all four.)    │
└──────────────────────────────────────────────────────────────────────┘
                          │  user types "How are we trending?"
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4. Chatbot turn                                                      │
│    • Browser POSTs message + the same dynamic context already on     │
│      screen.                                                         │
│    • Server builds the grounded system prompt and calls Groq         │
│      (llama-3.3-70b-versatile).                                      │
│    • Groq replies in 2–4 sentences, citing only the supplied facts.  │
│    • Reply renders in the chat panel. (AI-GENERATED.)                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick reference: where does X come from?

| Thing the user sees | Layer | Source of truth |
| --- | --- | --- |
| The 5 league cards on the home screen | Static | `src/data/leagues.ts` |
| League purple/red/blue colors | Static | `src/data/leagues.ts` |
| Team list in a league | Dynamic | ESPN `/teams` |
| Team crest image | Dynamic | `a.espncdn.com` |
| "1st in English Premier League" badge | Dynamic | ESPN team endpoint |
| Last 5 W/D/L results | Dynamic | ESPN team schedule (filtered for completed) |
| Full standings table | Dynamic | ESPN league standings |
| News headlines and lead story | Dynamic | ESPN news feed |
| The chatbot's reply text | AI-generated | Groq, grounded in the four dynamic items above |

---

## Why this split matters

A user shouldn't have to wonder whether the score they're looking at is real. By keeping the AI strictly *downstream* of the data layer — and refusing to let it invent — Touchline makes a clean promise:

> Numbers and headlines on screen are always from the official feed. The chatbot can only talk about those numbers and headlines.

Everything else flows from that.
