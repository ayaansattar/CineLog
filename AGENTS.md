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

## Stack (current)

- React (Vite) + Tailwind frontend
- Express API; serves `dist/` in production
- Prisma + SQLite
- TMDB (proxied server-side); Anthropic planned for recs

## Milestones

Update status: `pending` → `in_progress` → `done`. Add a one-line note under Done when finishing.

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Project scaffold + DB schema + basic CRUD for entries | done |
| 2 | TMDB search + add to library | done |
| 3 | Library views (watchlist / watching / watched grids) | done |
| 4 | In-progress tracking (watching status, TV S/E, movie progress mark) | done |
| 5 | Ratings UI | done |
| 6 | CSV import (Letterboxd) | done |
| 7 | Plain-text import | pending |
| 8 | AI recommendation chat (candidate pool → Claude → cards) | pending |
| 9 | Production build + deploy (Railway/Fly + persistent SQLite volume) | in_progress |

### Done

- **1–2**: Scaffolded Vite/React/Tailwind + Express + Prisma/SQLite; entries CRUD; TMDB multi-search proxy; add as watchlist/watched with poster/genres; basic library list on home.
- **3**: Library tab with Watchlist / Watching / Watched grids; filters (type, genre) and sort; move status / remove from cards; API accepts `watching` status.
- **4**: Progress fields (`currentSeason`/`currentEpisode`, `progressMark`, `progressUpdatedAt`); Watching cards show `S2E5` / mark overlay; inline editor + Next ep; start watching defaults TV to S1E1.
- **5**: Half-star ratings (0–5 / 0.5); click cycles half → full → clear; setting a rating moves entry to Watched; Watched tab defaults to sort by rating.
- **6**: Letterboxd CSV one-time import via `npm run import:letterboxd` (reads `data/watched.csv`); no Import UI.

### Next up

- **7**: Plain-text list import.

## Working notes

- Env: `.env` from `.env.example` — `TMDB_API_KEY` required for search; never expose to client.
- Dev: `npm run dev` (Vite `:5173`, API `:3001`, `/api` proxied).
- DB: `npm run db:push` after schema changes.
- Spec progress fields are in schema/UI (milestone 4 done).
- **Letterboxd import**: auto-detects `data/letterboxd-*/`; imports ratings → watched → watchlist. Export folders are gitignored.
- **Deploy**: pushed `feat: add Railway production deploy config`. Mount volume at `/app/data`, set `DATABASE_URL=file:/app/data/cinelog.db`, `NODE_ENV=production`. Generate `*.up.railway.app` domain for TMDB application URL.
