import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../server/db.js';
import { matchTitleYear, sleep } from '../server/tmdbClient.js';
import { storeGenres } from '../server/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const listPath = path.join(rootDir, 'data', 'parsed-pdf-lists.json');

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dedupeKey(title, year) {
  return `${normalizeTitle(title)}::${year ?? ''}`;
}

function tmdbKey(mediaType, tmdbId) {
  return `${mediaType}:${tmdbId}`;
}

async function main() {
  if (!fs.existsSync(listPath)) {
    console.error(`Missing ${listPath}. Run: python scripts/parse_pdf_lists.py`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  const items = [...parsed.movies, ...parsed.tv];
  console.log(`Importing ${items.length} PDF titles (${parsed.counts.movies} movies, ${parsed.counts.tv} TV)…`);

  const existing = await prisma.entry.findMany({
    select: { title: true, year: true, tmdbId: true, mediaType: true },
  });

  const byTitleYear = new Set(existing.map((e) => dedupeKey(e.title, e.year)));
  const byTitle = new Set(existing.map((e) => normalizeTitle(e.title)));
  const byTmdb = new Set(
    existing.filter((e) => e.tmdbId != null).map((e) => tmdbKey(e.mediaType, e.tmdbId))
  );

  const summary = {
    total: items.length,
    added: 0,
    skippedDuplicates: 0,
    unmatched: 0,
    watching: 0,
    watchlist: 0,
  };

  for (const item of items) {
    const norm = normalizeTitle(item.title);
    if (byTitle.has(norm) || byTitleYear.has(dedupeKey(item.title, item.year))) {
      summary.skippedDuplicates += 1;
      continue;
    }

    let matched = null;
    try {
      matched = await matchTitleYear(item.title, item.year ?? null, item.mediaType);
      await sleep(120);
    } catch (err) {
      if (err.status === 503 || err.status === 429) throw err;
      console.warn('TMDB match failed for', item.title, err.message);
    }

    if (matched?.tmdbId != null && byTmdb.has(tmdbKey(matched.mediaType, matched.tmdbId))) {
      summary.skippedDuplicates += 1;
      byTitle.add(norm);
      continue;
    }

    // Also skip if matched title already in library under a different spelling
    if (matched && byTitle.has(normalizeTitle(matched.title))) {
      summary.skippedDuplicates += 1;
      continue;
    }

    const status = item.status === 'watching' ? 'watching' : 'watchlist';
    const mediaType = matched?.mediaType || item.mediaType || 'movie';

    const entry = await prisma.entry.create({
      data: {
        tmdbId: matched?.tmdbId ?? null,
        title: matched?.title || item.title,
        year: matched?.year ?? item.year ?? null,
        mediaType,
        posterPath: matched?.posterPath ?? null,
        genres: storeGenres(matched?.genres ?? null),
        status,
        rating: null,
        notes: null,
        currentSeason: status === 'watching' && mediaType === 'tv' ? item.currentSeason ?? 1 : null,
        currentEpisode:
          status === 'watching' && mediaType === 'tv' ? item.currentEpisode ?? 1 : null,
        progressUpdatedAt: status === 'watching' ? new Date() : null,
        watchedAt: null,
      },
    });

    byTitleYear.add(dedupeKey(entry.title, entry.year));
    byTitle.add(normalizeTitle(entry.title));
    if (entry.tmdbId != null) byTmdb.add(tmdbKey(entry.mediaType, entry.tmdbId));

    summary.added += 1;
    if (status === 'watching') summary.watching += 1;
    else summary.watchlist += 1;
    if (!matched) summary.unmatched += 1;

    console.log(
      `  + [${status}] ${entry.title}${entry.year ? ` (${entry.year})` : ''} (${entry.mediaType})${
        matched ? '' : ' [unmatched]'
      }`
    );
  }

  console.log('\nDone.');
  console.log(`  Added: ${summary.added} (watching ${summary.watching}, watchlist ${summary.watchlist})`);
  console.log(`  Skipped duplicates: ${summary.skippedDuplicates}`);
  console.log(`  Unmatched (no TMDB): ${summary.unmatched}`);
  console.log(`  Rows read: ${summary.total}`);
}

try {
  await main();
} catch (err) {
  console.error('Import failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
