# Prompt: Personal Movie/TV Log with AI Recommendations

## Project overview

Build a web app called "CineLog" — a personal movie and TV show tracker similar to Letterboxd, with an AI-powered recommendation chatbot. Single user (me), no auth needed. Core loop: I log what I've watched and rate it, keep a watchlist, and ask an AI for suggestions based on my taste.

## Tech stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node/Express
- **Deployment model**: single deployable app — `vite build` produces a static `dist/` folder, and Express serves that folder as static files while also handling all `/api/...` routes on the same server/process. One app, one process, one deploy, no separate frontend/backend hosting.
- **Database**: SQLite (via Prisma or Drizzle) for a single-user local-first app — simple to run, easy to inspect, and persists fine as a file alongside the app as long as the host provides a persistent disk (see Deployment section)
- **External APIs**: TMDB (The Movie Database) for metadata/posters, Anthropic API for recommendations

## Data model

```
Entry {
  id
  tmdbId (nullable — null if manually added without a TMDB match)
  title
  year
  mediaType: 'movie' | 'tv'
  posterPath (nullable)
  genres (array of strings, nullable)
  status: 'watchlist' | 'watched'
  rating (0–5, step 0.5, nullable — only set when watched)
  notes (text, nullable)
  addedAt (timestamp)
  watchedAt (timestamp, nullable)
}
```

## Feature 1: TMDB search & add

- Search bar hits TMDB's `/search/multi` endpoint, shows results with poster, title, year, media type.
- Clicking a result adds it to my library as `watchlist` or `watched` (toggle before adding), pulling in poster, genres, TMDB ID.
- Store my TMDB API key server-side as an env var; never expose it to the client — proxy TMDB calls through my own backend.

## Feature 2: Letterboxd CSV import

- Upload or paste a Letterboxd CSV export (handle both `watched.csv`/diary format with columns `Date,Name,Year,Letterboxd URI` and `ratings.csv` which adds a `Rating` column, 0.5–5 scale).
- Parse properly (handle quoted fields with embedded commas).
- For each row, attempt to match against TMDB by title + year (`/search/movie` or `/search/multi`, pick best match) to enrich with poster/genres. If no confident match, still add the entry with just title/year and no TMDB data.
- Let me choose whether the batch being imported is `watched` or `watchlist` before importing.
- Skip duplicates (match on title + year already in my library).
- Show a summary after import: added X, skipped Y duplicates, Z unmatched (no TMDB data found).

## Feature 3: Plain-text list import (for my Google Docs lists)

- A textarea where I paste plain text, one title per line, formats like `Title` or `Title (Year)`.
- Same TMDB-matching and dedup logic as CSV import.

## Feature 4: Manual add/edit

- Manually add a title without TMDB (title + year + type).
- Edit any entry: change status, rating, notes.
- Delete entries.

## Feature 5: Ratings

- Star rating UI, 0–5 in 0.5 increments, Letterboxd-style (click a star, click again for half).
- Setting a rating auto-flips status to `watched`.
- Watched list sortable by rating, date watched, or title.

## Feature 6: AI recommendation chat

This is the core feature — design it carefully:

1. When I type a request like "something like Pulp Fiction but funnier" or "I want a slow-burn thriller," the backend:
   - Builds a **candidate pool** from TMDB: pull `/movie/{id}/similar` and `/movie/{id}/recommendations` for my 10–15 highest-rated watched titles, plus a general trending/popular pull for variety. Dedupe against titles already in my library. Aim for ~40–80 candidates.
   - Sends the candidate pool (title, year, genres, overview) + my taste profile (my watched titles with ratings, grouped by genre if easy) + my query to the Anthropic API.
   - Prompts the model to pick and rank the best 6 candidates for my specific request, with a short reason for each, and to tag each as either "matches your taste" (similar to high-rated titles) or "popular pick" (broadly liked, not necessarily matched to my ratings).
   - **Important**: constrain the model to only pick from the candidate pool you send it — don't let it freely invent titles outside that list. This keeps recommendations grounded in real, current TMDB data instead of relying on model memory.
2. Return structured JSON from the model (title, year, tmdbId, reason, source tag) and render as cards with poster art pulled from TMDB.
3. Each recommendation card has an "add to watchlist" button.

## Feature 7: Library views

- Watchlist and Watched as separate tabs/pages, grid of poster cards.
- Basic filters: by media type (movie/TV), by genre, sort by rating/date.

## Deployment

- Build as a single deployable app: Express serves the built Vite frontend (`app.use(express.static('dist'))`) and handles all API routes in the same process — no separate frontend/backend hosting.
- Target host: **Railway** or **Fly.io** (either works well — both support persistent disk volumes, which the SQLite file needs, and both deploy straightforward Node apps via `git push` or a CLI command).
- The SQLite file must live on a persistent volume/disk on whichever host is chosen — confirm this is configured, since some platforms (e.g. typical serverless functions) wipe local files between deploys.
- Include a production build + start script (e.g. `npm run build && npm start`) and document the exact deploy steps for the chosen host in the README.
- `TMDB_API_KEY` and `ANTHROPIC_API_KEY` are set as environment variables on the host platform's dashboard — never committed to the repo, never sent to the client.

## Non-functional requirements

- Responsive, works well on mobile.
- Handle TMDB/Anthropic API failures gracefully (rate limits, no matches) — don't crash the UI, show a clear message.
- Include a README with setup steps (get TMDB key, get Anthropic key, install, run migrations, start dev server, deploy to production host).

## Build order

Do this incrementally, get each step working before moving on:

1. Project scaffold + DB schema + basic CRUD for entries
2. TMDB search + add to library
3. Library views (watchlist/watched grids)
4. Ratings UI
5. CSV import
6. Plain-text import
7. AI recommendation feature (candidate pool retrieval → Claude ranking → cards)
8. Production build + deploy as a single app to Railway or Fly.io, with a persistent volume for the SQLite file

---

*Note: trim scope (e.g., drop plain-text import or filters) for a faster first pass — the recommendation engine in step 7 deserves the most design time, since the candidate-pool approach is what keeps it from hallucinating movies that don't exist.*
