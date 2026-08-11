# Letterboxd export

Extract your Letterboxd zip under `data/` (e.g. `data/letterboxd-…/`).

Then run:

```bash
npm run import:letterboxd
```

That imports, in order:

1. `ratings.csv` → **watched** (with star ratings)
2. `watched.csv` → **watched** (fills any gaps; duplicates skipped)
3. `watchlist.csv` → **watchlist**

Optional:

```bash
npm run import:letterboxd -- --dir=data/letterboxd-ayaansattar-2026-08-11-01-50-utc
npm run import:letterboxd -- --file=data/…/watchlist.csv --status=watchlist
```

Export folders and zips are gitignored (personal data).
