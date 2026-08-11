import prisma from './db.js';
import { mapLetterboxdRows } from './csv.js';
import { matchTitleYear, sleep } from './tmdbClient.js';
import { storeGenres } from './utils.js';

const MAX_ROWS = 1000;

function dedupeKey(title, year) {
  return `${String(title).toLowerCase().trim()}::${year ?? ''}`;
}

/**
 * Import Letterboxd CSV text into the library.
 * @param {string} csvText
 * @param {'watchlist'|'watched'} status
 */
export async function importLetterboxdCsv(csvText, status = 'watched') {
  if (!['watchlist', 'watched'].includes(status)) {
    throw new Error('status must be watchlist or watched');
  }

  const items = mapLetterboxdRows(csvText);
  if (!items.length) {
    throw new Error('No valid rows found in CSV');
  }
  if (items.length > MAX_ROWS) {
    throw new Error(
      `CSV has ${items.length} rows; max per import is ${MAX_ROWS}. Split the file and try again.`
    );
  }

  const existing = await prisma.entry.findMany({
    select: { title: true, year: true },
  });
  const existingKeys = new Set(existing.map((e) => dedupeKey(e.title, e.year)));

  const summary = {
    total: items.length,
    added: 0,
    skippedDuplicates: 0,
    unmatched: 0,
  };

  for (const item of items) {
    const key = dedupeKey(item.title, item.year);
    if (existingKeys.has(key)) {
      summary.skippedDuplicates += 1;
      continue;
    }

    let matched = null;
    try {
      matched = await matchTitleYear(item.title, item.year);
      await sleep(120);
    } catch (err) {
      if (err.status === 503 || err.status === 429) throw err;
      console.warn('TMDB match failed for', item.title, err.message);
    }

    const rating = status === 'watched' && item.rating != null ? item.rating : null;
    const watchedAt =
      status === 'watched'
        ? item.watchedAt
          ? new Date(item.watchedAt)
          : new Date()
        : null;

    const entry = await prisma.entry.create({
      data: {
        tmdbId: matched?.tmdbId ?? null,
        title: matched?.title || item.title,
        year: matched?.year ?? item.year,
        mediaType: matched?.mediaType || 'movie',
        posterPath: matched?.posterPath ?? null,
        genres: storeGenres(matched?.genres ?? null),
        status,
        rating,
        notes: null,
        watchedAt,
      },
    });

    existingKeys.add(dedupeKey(entry.title, entry.year));
    summary.added += 1;
    if (!matched) summary.unmatched += 1;
    console.log(
      `  + ${entry.title}${entry.year ? ` (${entry.year})` : ''}${matched ? '' : ' [unmatched]'}`
    );
  }

  return summary;
}
