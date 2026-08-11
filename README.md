# CineLog

Personal movie/TV tracker with TMDB search and (soon) AI recommendations.

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **Environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set:

- `TMDB_API_KEY` — from [TMDB settings](https://www.themoviedb.org/settings/api) (you can deploy first, then paste the key into Railway later)
- `ANTHROPIC_API_KEY` — optional until the AI feature lands
- `DATABASE_URL` — leave as `file:./dev.db` for local SQLite

3. **Create the database**

```bash
npm run db:push
```

4. **Run locally**

```bash
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001  

Vite proxies `/api` to the Express server.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Client + API in watch mode |
| `npm run build` | Production Vite build → `dist/` |
| `npm start` | Sync Prisma schema, then serve API + static `dist/` |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio |

## Deploy to Railway

One Node service: Express serves the Vite `dist/` build and `/api` on the same process.

1. Push this repo to GitHub (already configured as `origin`).
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub** → select `CineLog`.
3. Add a **Volume** on the service with mount path `/app/data` (required so SQLite survives redeploys).
4. Set **Variables** on the service:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `file:/app/data/cinelog.db` |
| `TMDB_API_KEY` | your key (add when you have it) |
| `ANTHROPIC_API_KEY` | optional for now |

5. Generate a public domain: service → **Settings → Networking → Generate Domain**.
6. Use that `*.up.railway.app` URL on the TMDB API key application form as your website / application URL.
7. After TMDB approves, paste the key into Railway variables and redeploy if needed.

Build/start are defined in `railway.json` (`npm run build` / `npm start`). Health check: `/api/health`.

## Current features

- TMDB multi-search (server-proxied; API key never sent to the browser)
- Add results as **watchlist**, **watching**, or **watched**, enriched with poster + genres
- Library tab: Watchlist / Watching / Watched grids with type/genre filters and sorting
- Move titles between statuses or remove them from library cards
- Production deploy config for Railway + persistent SQLite volume

## Next up

In-progress tracking (S/E + movie progress mark), ratings, CSV/plain-text import, AI recommendations.
