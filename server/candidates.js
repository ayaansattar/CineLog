import { tmdbFetch, yearFromDate } from './tmdbClient.js';

const TARGET_MIN = 40;
const TARGET_MAX = 120;
const TOP_SEED_COUNT = 15;
const CONCURRENCY = 4;

function libraryKey(mediaType, tmdbId) {
  return `${mediaType}:${tmdbId}`;
}

function mapListItem(item, mediaType) {
  const title = mediaType === 'movie' ? item.title : item.name;
  if (!title || !item.id) return null;
  const year = yearFromDate(
    mediaType === 'movie' ? item.release_date : item.first_air_date
  );
  return {
    tmdbId: item.id,
    title,
    year,
    mediaType,
    posterPath: item.poster_path ?? null,
    overview: (item.overview || '').slice(0, 280),
    genreIds: item.genre_ids || [],
  };
}

async function mapPool(items, limit = CONCURRENCY) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    results.push(...(await Promise.all(chunk.map((fn) => fn()))));
  }
  return results;
}

async function loadGenreMaps() {
  const [movie, tv] = await Promise.all([
    tmdbFetch('/genre/movie/list', { language: 'en-US' }),
    tmdbFetch('/genre/tv/list', { language: 'en-US' }),
  ]);
  const movieMap = new Map((movie.genres || []).map((g) => [g.id, g.name]));
  const tvMap = new Map((tv.genres || []).map((g) => [g.id, g.name]));
  return { movieMap, tvMap };
}

function resolveGenres(candidate, genreMaps) {
  const map = candidate.mediaType === 'tv' ? genreMaps.tvMap : genreMaps.movieMap;
  return (candidate.genreIds || []).map((id) => map.get(id)).filter(Boolean);
}

/**
 * Build a grounded recommendation candidate pool from the user's library + TMDB.
 */
export async function buildCandidatePool(prisma) {
  const entries = await prisma.entry.findMany();
  const tasteProfile = buildTasteProfile(entries);
  const inLibrary = new Set(
    entries
      .filter((e) => e.tmdbId != null)
      .map((e) => libraryKey(e.mediaType, e.tmdbId))
  );

  const ratedWatched = entries
    .filter((e) => e.status === 'watched' && e.tmdbId != null && e.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.watchedAt - a.watchedAt);

  let seeds = ratedWatched.slice(0, TOP_SEED_COUNT);
  if (seeds.length < 5) {
    const extra = entries
      .filter(
        (e) =>
          e.tmdbId != null &&
          !seeds.some((s) => s.id === e.id) &&
          (e.status === 'watched' || e.status === 'watching')
      )
      .slice(0, TOP_SEED_COUNT - seeds.length);
    seeds = [...seeds, ...extra];
  }

  const byKey = new Map();

  function addItems(results, mediaType) {
    for (const raw of results || []) {
      const mapped = mapListItem(raw, mediaType);
      if (!mapped) continue;
      const key = libraryKey(mapped.mediaType, mapped.tmdbId);
      if (inLibrary.has(key) || byKey.has(key)) continue;
      byKey.set(key, mapped);
    }
  }

  await mapPool(
    seeds.map((seed) => async () => {
      const type = seed.mediaType;
      const id = seed.tmdbId;
      try {
        const [similar, recs] = await Promise.all([
          tmdbFetch(`/${type}/${id}/similar`, { language: 'en-US', page: '1' }),
          tmdbFetch(`/${type}/${id}/recommendations`, {
            language: 'en-US',
            page: '1',
          }),
        ]);
        addItems(similar.results, type);
        addItems(recs.results, type);
      } catch (err) {
        console.warn(`Candidate seed failed for ${type}/${id}:`, err.message);
      }
    })
  );

  if (byKey.size < TARGET_MIN) {
    try {
      const [trendingMovies, trendingTv, popularMovies, popularTv] = await Promise.all([
        tmdbFetch('/trending/movie/week', { language: 'en-US' }),
        tmdbFetch('/trending/tv/week', { language: 'en-US' }),
        tmdbFetch('/movie/popular', { language: 'en-US', page: '1' }),
        tmdbFetch('/tv/popular', { language: 'en-US', page: '1' }),
      ]);
      addItems(trendingMovies.results, 'movie');
      addItems(trendingTv.results, 'tv');
      addItems(popularMovies.results, 'movie');
      addItems(popularTv.results, 'tv');
    } catch (err) {
      console.warn('Trending/popular pull failed:', err.message);
    }
  } else {
    // Always sprinkle a little variety even when seed pool is healthy
    try {
      const [trendingMovies, trendingTv] = await Promise.all([
        tmdbFetch('/trending/movie/week', { language: 'en-US' }),
        tmdbFetch('/trending/tv/week', { language: 'en-US' }),
      ]);
      addItems((trendingMovies.results || []).slice(0, 10), 'movie');
      addItems((trendingTv.results || []).slice(0, 10), 'tv');
    } catch (err) {
      console.warn('Trending variety pull failed:', err.message);
    }
  }

  const genreMaps = await loadGenreMaps();
  const candidates = [...byKey.values()].slice(0, TARGET_MAX).map((c, index) => {
    const { genreIds, ...rest } = c;
    return {
      id: `c${index}`,
      entryId: null,
      ...rest,
      genres: resolveGenres(c, genreMaps),
    };
  });

  return {
    source: 'discover',
    seeds: seeds.map((s) => ({
      title: s.title,
      year: s.year,
      rating: s.rating,
      mediaType: s.mediaType,
    })),
    tasteProfile,
    candidates,
  };
}

/**
 * Candidate pool = titles already on the user's watchlist.
 */
export async function buildWatchlistPool(prisma) {
  const entries = await prisma.entry.findMany();
  const tasteProfile = buildTasteProfile(entries);

  const watchlist = entries
    .filter((e) => e.status === 'watchlist')
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  const candidates = watchlist.slice(0, TARGET_MAX).map((e, index) => ({
    id: `w${index}`,
    entryId: e.id,
    tmdbId: e.tmdbId,
    title: e.title,
    year: e.year,
    mediaType: e.mediaType,
    posterPath: e.posterPath ?? null,
    overview: '',
    genres: parseGenresJson(e.genres),
  }));

  return {
    source: 'watchlist',
    seeds: [],
    tasteProfile,
    candidates,
  };
}

function parseGenresJson(genres) {
  if (!genres) return null;
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildTasteProfile(entries) {
  return entries
    .filter((e) => e.status === 'watched' && e.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.watchedAt - a.watchedAt)
    .slice(0, 40)
    .map((e) => ({
      title: e.title,
      year: e.year,
      mediaType: e.mediaType,
      rating: e.rating,
      genres: parseGenresJson(e.genres),
    }));
}

