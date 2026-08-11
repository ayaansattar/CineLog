const TMDB_BASE = 'https://api.themoviedb.org/3';

function getApiKey() {
  return process.env.TMDB_API_KEY;
}

export async function tmdbFetch(path, params = {}) {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    const err = new Error('TMDB_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, value);
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`TMDB request failed (${res.status}): ${body.slice(0, 200)}`);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }
  return res.json();
}

export function yearFromDate(dateStr) {
  if (!dateStr) return null;
  const year = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Match a Letterboxd title+year against TMDB (movies first, then multi).
 * Returns enriched metadata or null if no confident match.
 */
export async function matchTitleYear(title, year) {
  const params = {
    query: title,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  };
  if (year) params.year = String(year);

  const movieData = await tmdbFetch('/search/movie', params);
  const movieHit = pickBestMatch(movieData.results || [], title, year, 'movie');
  if (movieHit) {
    const details = await tmdbFetch(`/movie/${movieHit.id}`, { language: 'en-US' });
    return {
      tmdbId: details.id,
      title: details.title,
      year: yearFromDate(details.release_date) ?? year,
      mediaType: 'movie',
      posterPath: details.poster_path ?? null,
      genres: (details.genres || []).map((g) => g.name),
    };
  }

  const multiData = await tmdbFetch('/search/multi', {
    query: title,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  const multiHit = pickBestMatch(
    (multiData.results || []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv'),
    title,
    year
  );
  if (!multiHit) return null;

  const mediaType = multiHit.media_type || 'movie';
  const details = await tmdbFetch(`/${mediaType}/${multiHit.id}`, { language: 'en-US' });
  const detailTitle = mediaType === 'movie' ? details.title : details.name;
  const detailYear = yearFromDate(
    mediaType === 'movie' ? details.release_date : details.first_air_date
  );

  return {
    tmdbId: details.id,
    title: detailTitle,
    year: detailYear ?? year,
    mediaType,
    posterPath: details.poster_path ?? null,
    genres: (details.genres || []).map((g) => g.name),
  };
}

function pickBestMatch(results, title, year, forceType) {
  if (!results.length) return null;
  const want = normalizeTitle(title);
  const scored = [];

  for (const item of results) {
    const mediaType = forceType || item.media_type;
    if (mediaType !== 'movie' && mediaType !== 'tv') continue;

    const itemTitle = mediaType === 'movie' ? item.title : item.name;
    const itemYear = yearFromDate(
      mediaType === 'movie' ? item.release_date : item.first_air_date
    );
    const norm = normalizeTitle(itemTitle);
    let score = 0;

    if (norm === want) score += 10;
    else if (norm.includes(want) || want.includes(norm)) score += 4;
    else continue;

    if (year && itemYear === year) score += 8;
    else if (year && itemYear && Math.abs(itemYear - year) === 1) score += 2;
    else if (year && itemYear && Math.abs(itemYear - year) > 1) score -= 5;

    scored.push({ item: { ...item, media_type: mediaType }, score });
  }

  scored.sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 10) return null;
  return scored[0].item;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
