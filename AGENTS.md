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
| 3 | Library views (watchlist / watching / watched grids) | pending |
| 4 | In-progress tracking (watching status, TV S/E, movie progress mark) | pending |
| 5 | Ratings UI | pending |
| 6 | CSV import (Letterboxd) | pending |
| 7 | Plain-text import | pending |
| 8 | AI recommendation chat (candidate pool → Claude → cards) | pending |
| 9 | Production build + deploy (Railway/Fly + persistent SQLite volume) | pending |

### Done

- **1–2**: Scaffolded Vite/React/Tailwind + Express + Prisma/SQLite; entries CRUD; TMDB multi-search proxy; add as watchlist/watched with poster/genres; basic library list on home.

### Next up

- **3**: Dedicated library views for watchlist / watching / watched.

## Working notes

- Env: `.env` from `.env.example` — `TMDB_API_KEY` required for search; never expose to client.
- Dev: `npm run dev` (Vite `:5173`, API `:3001`, `/api` proxied).
- DB: `npm run db:push` after schema changes.
- Spec also includes `watching` status + progress fields — not in schema/UI yet (milestone 4).
