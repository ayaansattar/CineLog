# CineLog

Personal movie/TV tracker with TMDB search and Gemini recommendations.

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **Create a Neon database**

- Sign up at [neon.tech](https://neon.tech) → new project
- Copy the connection string (**pooled** or direct is fine) and append `?sslmode=require` if missing

3. **Environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` — Neon Postgres URL
- `TMDB_API_KEY` — from [TMDB settings](https://www.themoviedb.org/settings/api)
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey) (Recs tab)

4. **Create tables**

```bash
npm run db:push
```

5. **(Optional) Restore from a JSON export**

```bash
npm run import:entries
```

(`data/entries-export.json` from `npm run export:entries`)

6. **Run locally**

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
| `npm run import:letterboxd` | Import Letterboxd export from `data/letterboxd-*/` |
| `npm run import:pdf` | Parse + import `data/Movies.pdf` and `data/TV shows.pdf` |
| `npm run export:entries` | Dump all entries to `data/entries-export.json` |
| `npm run import:entries` | Load `data/entries-export.json` into the current `DATABASE_URL` |
| `npm run db:push` | Sync Prisma schema to Postgres |
| `npm run db:studio` | Open Prisma Studio |

## Deploy to Render (free)

One Node service: Express serves the Vite `dist/` build and `/api`. Data lives in **Neon**, so no paid disk is required.

1. Push this repo to GitHub.
2. In [Render](https://dashboard.render.com): **New → Blueprint** → connect the repo (`render.yaml`), or create a **Web Service** manually:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Plan:** Free
3. Set environment variables (same Neon DB is fine for a personal app, or create a separate Neon branch/DB for prod):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Neon URL (`?sslmode=require`) |
| `TMDB_API_KEY` | your TMDB key |
| `GEMINI_API_KEY` | your Google AI Studio key |

4. Deploy → open `*.onrender.com` → check `/api/health`.
5. Add that URL on your [TMDB API](https://www.themoviedb.org/settings/api) app if they ask for a website URL.

Free Render services **spin down** when idle; the first request after idle can take ~30–60s.

## Current features

- TMDB multi-search (server-proxied; API key never sent to the browser)
- Add results as **watchlist**, **watching**, or **watched**, enriched with poster + genres
- Library tab: Watchlist / Watching / Watched grids with type/genre filters and sorting
- In-progress tracking: TV season/episode (`S2E5`) and movie progress marks on Watching cards
- Half-star ratings (0–5); rating a title moves it to Watched
- One-time Letterboxd CSV import (`data/watched.csv` + `npm run import:letterboxd`)
- Move titles between statuses or remove them from library cards
- Recs tab: Gemini ranks a TMDB candidate pool into grounded picks
- Neon Postgres + Render free deploy (`render.yaml`)
- Live: https://cinelog-q45t.onrender.com

## Letterboxd / PDF import

See [`data/README.md`](./data/README.md). Batch importers live under `scripts/` (no in-app upload UI).
