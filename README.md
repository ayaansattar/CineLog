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

- `TMDB_API_KEY` — from [TMDB settings](https://www.themoviedb.org/settings/api)
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
| `npm start` | Serve API + static `dist/` (set `NODE_ENV=production`) |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio |

## Current features

- TMDB multi-search (server-proxied; API key never sent to the browser)
- Add results as **watchlist** or **watched**, enriched with poster + genres
- Basic library list of saved entries

## Next up

Ratings UI, Letterboxd CSV import, plain-text import, AI recommendations, production deploy.
