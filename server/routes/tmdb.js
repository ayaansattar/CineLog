import { Router } from 'express';

const router = Router();
const TMDB_BASE = 'https://api.themoviedb.org/3';

function getApiKey() {
  return process.env.TMDB_API_KEY;
}

async function tmdbFetch(path, params = {}) {
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

function yearFromDate(dateStr) {
  if (!dateStr) return null;
  const year = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function mapSearchResult(item) {
  const mediaType = item.media_type;
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;

  const title = mediaType === 'movie' ? item.title : item.name;
  const year = yearFromDate(
    mediaType === 'movie' ? item.release_date : item.first_air_date
  );

  return {
    tmdbId: item.id,
    title,
    year,
    mediaType,
    posterPath: item.poster_path ?? null,
    overview: item.overview ?? '',
  };
}

router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) return res.status(400).json({ error: 'Query "q" is required' });

    const data = await tmdbFetch('/search/multi', {
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });

    const results = (data.results || [])
      .map(mapSearchResult)
      .filter(Boolean)
      .slice(0, 20);

    res.json({ results });
  } catch (err) {
    console.error('GET /api/tmdb/search', err);
    res.status(err.status || 500).json({
      error: err.message || 'TMDB search failed',
    });
  }
});

router.get('/details/:mediaType/:id', async (req, res) => {
  try {
    const { mediaType, id } = req.params;
    if (!['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }

    const details = await tmdbFetch(`/${mediaType}/${id}`, { language: 'en-US' });

    const title = mediaType === 'movie' ? details.title : details.name;
    const year = yearFromDate(
      mediaType === 'movie' ? details.release_date : details.first_air_date
    );
    const genres = (details.genres || []).map((g) => g.name);

    res.json({
      tmdbId: details.id,
      title,
      year,
      mediaType,
      posterPath: details.poster_path ?? null,
      genres,
      overview: details.overview ?? '',
    });
  } catch (err) {
    console.error('GET /api/tmdb/details', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to load TMDB details',
    });
  }
});

export default router;
