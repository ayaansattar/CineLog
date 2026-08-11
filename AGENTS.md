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
- Prisma + **Neon Postgres**
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
| 9 | Production build + deploy (Render free + Neon Postgres) | done |

### Done notes

- **1–2**: Vite/React/Tailwind + Express + Prisma; entries CRUD; TMDB multi-search proxy; add to library with poster/genres.
- **3**: Search / Library nav; Watchlist · Watching · Watched grids; type/genre filters; sort; status moves + delete.
- **4**: `currentSeason` / `currentEpisode` / `progressMark` / `progressUpdatedAt`; Watching card overlay + editor + Next ep.
- **5**: Half-star ratings (left half = .5, right = full; click again clears); rating → status `watched`.
- **6**: CLI Letterboxd import (`npm run import:letterboxd`). Also ran one-time PDF list import.
- **7**: Skipped — Google Docs lists already imported via PDF/Letterboxd paths.
- **8**: Recs tab; candidate pool → Gemini; watchlist/discover modes; movie/TV/genre detection. Needs `GEMINI_API_KEY`.
- **9**: Render free at https://cinelog-q45t.onrender.com — Neon Postgres, no disk. Fixed Vite install on build, static `dist/` serving, cold-start library fetch retry.
- **Polish**: Poster hover summary (TMDB overview); genres on cards; library Heading filter (Watchlist/Watching). `Entry.overview` cached after first hover when logged in. Collapsible headings (persisted in localStorage). Headings scoped per status + media type (Watchlist vs Watching are separate).

### Next session

1. Confirm `AUTH_PASSWORD` is set on Render (same as local `.env`); redeploy if needed.
2. Optional polish: chat history, cache candidate pools, custom domain.
3. Rotate Neon password if it was ever pasted into chat; keep Render env in sync.

## Layout

```
src/                 React app (App, components, api)
server/              Express + Prisma helpers + routes
prisma/              Schema (Postgres via DATABASE_URL)
scripts/             Importers + entry export/import
data/                Import sources / exports (gitignored); see data/README.md
docs/                GitHub Pages landing (TMDB app URL)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite `:5173` + API `:3001` (`/api` proxied) |
| `npm run build` / `npm start` | Production build; Express serves `dist/` |
| `npm run db:push` | Sync Prisma schema |
| `npm run export:entries` | Dump DB → `data/entries-export.json` |
| `npm run import:entries` | Load export into current `DATABASE_URL` |
| `npm run import:letterboxd` | Import Letterboxd export under `data/letterboxd-*/` |
| `npm run import:pdf` | Parse `data/*.pdf` (needs `pdfplumber`) + import |

## Working notes

- Env: copy `.env.example` → `.env`. `DATABASE_URL` = Neon Postgres (`?sslmode=require`). `TMDB_API_KEY` + `GEMINI_API_KEY` for search/recs; `AUTH_PASSWORD` for write/recs protection; never expose secrets to the client.
- Auth: cookie session after password login. GET library/search stay public; POST/PATCH/DELETE entries + POST recs require auth.
- Library: Movies/TV tabs; custom headings scoped per status + media type (`Section.status` + `Section.mediaType`); assign via card dropdown / drag on watchlist & watching.
- Render: free web service via `render.yaml`. No volume. Point `DATABASE_URL` at Neon. Set `AUTH_PASSWORD` in Render env.
- Public placeholder for TMDB: https://ayaansattar.github.io/CineLog/
- Personal import artifacts (`data/*.pdf`, `data/letterboxd-*`, `data/entries-export.json`, zips) are gitignored.
- PDF import uses Python `pdfplumber` (`pip install pdfplumber`).
- Live app: https://cinelog-q45t.onrender.com
