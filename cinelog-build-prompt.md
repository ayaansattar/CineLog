# Prompt: Personal Movie/TV Log with AI Recommendations

> **Implementation note (current stack):** Neon Postgres, Render free deploy, Gemini for recommendations.
> The feature goals below still apply; some hosting/API names in the original brief are outdated.

## Project overview

Build a web app called "CineLog" — a personal movie and TV show tracker similar to Letterboxd, with an AI-powered recommendation chatbot. Single user (me), no auth needed. Core loop: I log what I've watched and rate it, track in-progress titles (which show/episode I'm on, or where I left off in a movie), keep a watchlist, and ask an AI for suggestions based on my taste.

## Tech stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node/Express
- **Deployment model**: single deployable app — `vite build` produces a static `dist/` folder, and Express serves that folder as static files while also handling all `/api/...` routes on the same server/process. One app, one process, one deploy, no separate frontend/backend hosting.
- **Database**: Neon Postgres (via Prisma)
- **External APIs**: TMDB (The Movie Database) for metadata/posters, Google Gemini for recommendations
- **Hosting**: Render (free web service) + Neon

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
  status: 'watchlist' | 'watching' | 'watched'
  rating (0–5, step 0.5, nullable — only set when watched)
  notes (text, nullable)
  // Progress — used when status is 'watching' (nullable otherwise / when not set)
  currentSeason (int, nullable — TV only)
  currentEpisode (int, nullable — TV only)
  progressMark (string, nullable — movies: where I left off, e.g. "1:23:45", "halfway", "scene on the train")
  progressUpdatedAt (timestamp, nullable — last time progress was changed)
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
- Edit any entry: change status, rating, notes, and progress fields.
- Delete entries.

## Feature 5: In-progress tracking (watching)

Track what I'm actively watching and how far I am — separate from watchlist / finished.

- Status includes `watching` in addition to `watchlist` and `watched`.
- **TV shows**: mark as watching and set **current season + episode** (e.g. S2E5). Easy inline edit from the library card or detail view so I can bump the episode without digging through forms. Optionally show a short label like `S2E5` on the poster card.
- **Movies**: when watching, leave a **progress mark** — free-text / timestamp of where I left off (e.g. `1:23:45`, `after the heist`, `45 min`). Display that mark on the card or detail view.
- Moving an entry to `watching` should clear "finished" signals if needed; finishing (status → `watched`) can keep the last progress for reference or clear it — pick a simple default and stick to it.
- Library should surface currently watching titles (dedicated "Watching" tab/section and/or badge on cards), sorted by most recently updated progress by default.
- Setting a rating still auto-flips status to `watched` (same as ratings feature).

## Feature 6: Ratings

- Star rating UI, 0–5 in 0.5 increments, Letterboxd-style (click a star, click again for half).
- Setting a rating auto-flips status to `watched`.
- Watched list sortable by rating, date watched, or title.

## Feature 7: AI recommendation chat

This is the core feature — design it carefully:

1. When I type a request like "something like Pulp Fiction but funnier" or "I want a slow-burn thriller," the backend:
   - Builds a **candidate pool** from TMDB: pull `/movie/{id}/similar` and `/movie/{id}/recommendations` for my 10–15 highest-rated watched titles, plus a general trending/popular pull for variety. Dedupe against titles already in my library. Aim for ~40–80 candidates.
   - Sends the candidate pool (title, year, genres, overview) + my taste profile (my watched titles with ratings, grouped by genre if easy) + my query to the Gemini API.
   - Prompts the model to pick and rank the best 6 candidates for my specific request, with a short reason for each, and to tag each as either "matches your taste" (similar to high-rated titles) or "popular pick" (broadly liked, not necessarily matched to my ratings).
   - **Important**: constrain the model to only pick from the candidate pool you send it — don't let it freely invent titles outside that list. This keeps recommendations grounded in real, current TMDB data instead of relying on model memory.
2. Return structured JSON from the model (title, year, tmdbId, reason, source tag) and render as cards with poster art pulled from TMDB.
3. Each recommendation card has an "add to watchlist" button.

## Feature 8: Library views

- Watchlist, Watching, and Watched as separate tabs/pages, grid of poster cards.
- Watching cards show progress: `S2E5` for TV, progress mark for movies.
- Basic filters: by media type (movie/TV), by genre, sort by rating/date/progress updated.

## Deployment

- Build as a single deployable app: Express serves the built Vite frontend (`app.use(express.static('dist'))`) and handles all API routes in the same process — no separate frontend/backend hosting.
- Target host: **Render** free web service; data in **Neon Postgres** (no app disk required).
- Include a production build + start script (e.g. `npm run build && npm start`) and document the exact deploy steps in the README.
- `TMDB_API_KEY`, `GEMINI_API_KEY`, and `DATABASE_URL` are set as environment variables on the host — never committed to the repo, never sent to the client.

## Non-functional requirements

- Responsive, works well on mobile.
- Handle TMDB/Gemini API failures gracefully (rate limits, no matches) — don't crash the UI, show a clear message.
- Include a README with setup steps (get TMDB key, get Gemini key, Neon URL, install, run migrations, start dev server, deploy).

## Build order

Do this incrementally, get each step working before moving on:

1. Project scaffold + DB schema + basic CRUD for entries
2. TMDB search + add to library
3. Library views (watchlist / watching / watched grids)
4. In-progress tracking (watching status, TV season/episode, movie progress mark)
5. Ratings UI
6. CSV import
7. Plain-text import
8. AI recommendation feature (candidate pool retrieval → Gemini ranking → cards)
9. Production build + deploy as a single app to Render with Neon Postgres

---

*Note: trim scope (e.g., drop plain-text import or filters) for a faster first pass — the recommendation engine in step 7 deserves the most design time, since the candidate-pool approach is what keeps it from hallucinating movies that don't exist.*
