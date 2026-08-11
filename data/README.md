# data/

Import sources (mostly gitignored — personal lists).

## Letterboxd

Extract a Letterboxd zip under `data/` (folder name `letterboxd-…`), then:

```bash
npm run import:letterboxd
```

Imports `ratings.csv` → watched, `watched.csv` → watched (gaps), `watchlist.csv` → watchlist.

## PDF lists

Place `Movies.pdf` / `TV shows.pdf` here, then:

```bash
pip install pdfplumber
npm run import:pdf
```

Watching sections → `watching`; everything else → `watchlist`. Dedupes against existing library.
