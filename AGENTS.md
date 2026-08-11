# CineLog — Agent notes

Living project notes for the coding agent. **Update this file whenever a milestone is completed** (or meaningfully started/blocked). Keep it short and accurate.

Full product spec: [`cinelog-build-prompt.md`](./cinelog-build-prompt.md)

## Commit messages

Use Conventional Commits, focused on the **main thing** shipped in that commit:

| Prefix | When |
|--------|------|
| `feat` | New feature or user-facing capability |
| `fix` | Bug fix |

Rules:

- One short subject line: summarize the primary change, not every file touched.
- Prefer the most important outcome (e.g. `feat: add TMDB search and add-to-library`) over laundry lists.
- No trailing period on the subject. Optional body only if needed for context.

Examples:

```
feat: add TMDB search and add-to-library
feat: track watching progress for TV and movies
fix: prevent duplicate entries on TMDB add
```

Do **not** commit unless the user asks.

## Stack

- React (Vite) + Tailwind frontend
- Express API; serves `dist/` in production
- Prisma + SQLite
- TMDB (proxied server-side); Gemini for recs (`POST /api/recs`)

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Project scaffold + DB schema + basic CRUD for entries | done |
| 2 | TMDB search + add to library | done |
| 3 | Library views (watchlist / watching / watched grids) | done |
| 4 | In-progress tracking (watching status, TV S/E, movie progress mark) | done |
| 5 | Ratings UI | done |
| 6 | Letterboxd CSV import (CLI one-time migration) | done |
| 7 | Plain-text import | skipped |
| 8 | AI recommendation chat (candidate pool → Gemini → cards) | done |
| 9 | Production build + deploy (Railway + persistent SQLite volume) | in_progress |

### Done notes

- **1–2**: Vite/React/Tailwind + Express + Prisma/SQLite; entries CRUD; TMDB multi-search proxy; add to library with poster/genres.
- **3**: Search / Library nav; Watchlist · Watching · Watched grids; type/genre filters; sort; status moves + delete.
- **4**: `currentSeason` / `currentEpisode` / `progressMark` / `progressUpdatedAt`; Watching card overlay + editor + Next ep.
- **5**: Half-star ratings (left half = .5, right = full; click again clears); rating → status `watched`.
- **6**: CLI Letterboxd import (`npm run import:letterboxd`). Also ran one-time PDF list import (`Movies.pdf` / `TV shows.pdf` → watchlist, Watching section → watching).
- **7**: Skipped — Google Docs lists already imported via PDF/Letterboxd paths.
- **8**: Recs tab; `POST /api/recs` builds TMDB candidate pool (similar/recs from top-rated + trending), Gemini JSON picks ≤6 with reasons/tags; add to watchlist. Needs `GEMINI_API_KEY`.

### Next session

1. **Milestone 9** — finish Railway deploy + volume (prep already in repo; public placeholder is GitHub Pages). Set `GEMINI_API_KEY` + `TMDB_API_KEY` on Railway.
2. Optional polish: chat history, richer taste grouping, cache candidate pools.

## Layout

```
src/                 React app (App, components, api)
server/              Express + Prisma helpers + routes
prisma/              Schema (+ local SQLite via DATABASE_URL)
scripts/             One-time / batch importers
data/                Import sources (gitignored PDFs/exports); see data/README.md
docs/                GitHub Pages landing (TMDB app URL)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite `:5173` + API `:3001` (`/api` proxied) |
| `npm run build` / `npm start` | Production build; Express serves `dist/` |
| `npm run db:push` | Sync Prisma schema |
| `npm run import:letterboxd` | Import Letterboxd export under `data/letterboxd-*/` |
| `npm run import:pdf` | Parse `data/*.pdf` (needs `pdfplumber`) + import |

## Working notes

- Env: copy `.env.example` → `.env`. `TMDB_API_KEY` required for search/match; `GEMINI_API_KEY` required for Recs; never expose either to the client.
- SQLite: `DATABASE_URL=file:./dev.db` (Prisma resolves relative to `prisma/`).
- Railway: `railway.json` ready. Mount volume at `/app/data`, set `DATABASE_URL=file:/app/data/cinelog.db`, `NODE_ENV=production`.
- Public placeholder for TMDB: https://ayaansattar.github.io/CineLog/
- Personal import artifacts (`data/*.pdf`, `data/letterboxd-*`, zips, `parsed-pdf-lists.json`) are gitignored.
- PDF import uses Python `pdfplumber` (`pip install pdfplumber`).
