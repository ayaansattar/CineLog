import { Router } from 'express';
import { tmdbFetch, yearFromDate } from '../tmdbClient.js';

const router = Router();

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
