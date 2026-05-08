# Touchline ⚽

> Football, your team, on tap. Dark, magazine-style dashboard for Europe's top 5 leagues with a Groq-powered chatbot grounded in live ESPN data.

Pick a league → pick a team → land on a dashboard with the table, your last five, today's headlines, and an AI assistant that already knows the context.

![flow: leagues → teams → dashboard](https://placehold.co/600x60/0a0a0a/00FF87?text=leagues+%E2%86%92+teams+%E2%86%92+dashboard)

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite 6, Tailwind v4, Motion (Framer), Lucide icons |
| Backend | Node + Express 4 (proxy + cache + chat) |
| Live data | ESPN public JSON (standings, schedules, news, team logos) |
| AI | [Groq](https://groq.com/) · `llama-3.3-70b-versatile` |
| Lang | TypeScript everywhere |

No paid keys. No DB. ~5 MB build.

## Prerequisites

- **Node.js 20+** (`node -v`)
- A free Groq API key — [console.groq.com/keys](https://console.groq.com/keys)

## Run locally

```bash
# 1. Install
npm install

# 2. Configure your Groq key
cp .env.example .env
# then edit .env and paste your key:
# GROQ_API_KEY=gsk_xxx...

# 3. Start (web on :3000, api on :3001)
npm run dev
```

Open <http://localhost:3000>. The Vite dev server proxies `/api/*` to the Express server on `:3001` automatically.

## Project layout

```
.
├── index.html                     # SPA entry, loads Inter + Anton fonts
├── server/
│   └── index.ts                   # Express: ESPN proxy, news, Groq chat, 5-min cache
├── src/
│   ├── main.tsx                   # React entry
│   ├── App.tsx                    # 3-screen state machine: league → team → dashboard
│   ├── index.css                  # Tailwind v4 + grain texture + display font
│   ├── types.ts                   # All shared types
│   ├── data/
│   │   └── leagues.ts             # 5 league configs (colors, taglines, ESPN ids)
│   ├── services/
│   │   └── api.ts                 # Fetch helpers
│   ├── lib/
│   │   └── cn.ts                  # tailwind-merge + timeAgo helper
│   └── components/
│       ├── LeaguePicker.tsx       # Screen 1
│       ├── TeamPicker.tsx         # Screen 2
│       ├── Dashboard.tsx          # Screen 3 (compose)
│       ├── FormStrip.tsx          # Last 5 W/D/L pills
│       ├── LeagueTable.tsx        # Standings, your team highlighted
│       ├── NewsFeed.tsx           # Magazine grid: lead + 3-col
│       └── Chatbot.tsx            # Groq chat panel (sticky)
└── data/                          # Optional CSV fallbacks (not currently used)
```

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | Powers the dashboard chatbot |
| `PORT` | no | Server port (default `3001` dev, set by host in prod) |

## Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run Vite + Express side-by-side with auto-reload |
| `npm run dev:web` | Vite only |
| `npm run dev:api` | Express only |
| `npm run build` | Build the SPA into `dist/` |
| `npm start` | Production: Express serves `dist/` + `/api/*` on a single port |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Deploying for free

Two routes — pick the one that fits your habits.

### Option A · Render (recommended, simplest)

Render gives you a free web service with auto-deploy from GitHub. The free tier sleeps after 15 min idle and cold-starts in ~30s — fine for personal use.

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Web Service** → connect your repo.
3. Use these settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. **Environment** tab → add `GROQ_API_KEY`.
5. Click Deploy. Visit the `*.onrender.com` URL.

That's it. The Express server detects the built `dist/` and serves the SPA + `/api/*` from one port.

### Option B · Railway (no cold starts)

Railway gives $5/mo free credit and doesn't sleep.

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Railway auto-detects Node. In **Settings**, set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. **Variables** → add `GROQ_API_KEY`.
4. Generate a public domain under **Settings → Networking**.

### Option C · Fly.io

More control, but needs a Dockerfile. Skip unless you already use Fly.

## Troubleshooting

- **Empty standings or form** — ESPN sometimes throttles; wait a minute or restart. Cache TTL is 5 min.
- **Chatbot replies "I don't have that data"** — by design. Groq is grounded only on the standings/form/headlines we send it; it won't fabricate scores or transfer rumours.
- **Logo not loading** — ESPN serves crests from `a.espncdn.com`; check your network can reach that host.
- **Port already in use** — kill stragglers: `lsof -i :3000,3001` then `kill <pid>`.

## Architecture, in one breath

The app is three screens stitched by a state machine in [`App.tsx`](src/App.tsx). Picking a league hydrates a CSS-themed view; picking a team triggers parallel fetches for `/api/teams/...`, `/api/standings`, `/api/news`. The Express server proxies ESPN's public JSON (standings, schedule, team, news) with a 5-minute in-memory cache, then routes a `POST /api/chat` to Groq with a system prompt that **embeds** the team's standing, last-5 form, and top-6 headlines as ground truth — so the model answers from data, not vibes.

For a deeper pass on what's static vs. fetched vs. AI-generated, read **[`APPLICATION_FLOW.md`](./APPLICATION_FLOW.md)**.
