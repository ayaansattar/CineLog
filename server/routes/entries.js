import { Router } from 'express';
import prisma from '../db.js';
import { serializeEntry, serializeEntries, storeGenres } from '../utils.js';

const router = Router();
const STATUSES = ['watchlist', 'watching', 'watched'];

function toNullableInt(value) {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNullableString(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : null;
}

function parseRating(value) {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5 || Math.round(n * 2) !== n * 2) {
    const err = new Error('rating must be between 0 and 5 in 0.5 steps, or null');
    err.status = 400;
    throw err;
  }
  return n;
}

function applyProgressDefaults(data, existing) {
  const nextStatus = data.status ?? existing.status;
  const mediaType = data.mediaType ?? existing.mediaType;

  if (data.status === 'watching' && existing.status !== 'watching') {
    if (mediaType === 'tv') {
      if (data.currentSeason === undefined && existing.currentSeason == null) {
        data.currentSeason = 1;
      }
      if (data.currentEpisode === undefined && existing.currentEpisode == null) {
        data.currentEpisode = 1;
      }
    }
    data.progressUpdatedAt = new Date();
  }

  const progressTouched =
    data.currentSeason !== undefined ||
    data.currentEpisode !== undefined ||
    data.progressMark !== undefined;

  if (progressTouched) {
    data.progressUpdatedAt = new Date();
    if (nextStatus === 'watchlist' && data.status === undefined) {
      data.status = 'watching';
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !STATUSES.includes(String(status))) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    const entries = await prisma.entry.findMany({
      where: status ? { status: String(status) } : undefined,
      orderBy: { addedAt: 'desc' },
    });
    res.json(serializeEntries(entries));
  } catch (err) {
    console.error('GET /api/entries', err);
    res.status(500).json({ error: 'Failed to load entries' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const entry = await prisma.entry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(serializeEntry(entry));
  } catch (err) {
    console.error('GET /api/entries/:id', err);
    res.status(500).json({ error: 'Failed to load entry' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      tmdbId,
      title,
      year,
      mediaType,
      posterPath,
      genres,
      status = 'watchlist',
      rating,
      notes,
      currentSeason,
      currentEpisode,
      progressMark,
    } = req.body;

    if (!title || !mediaType) {
      return res.status(400).json({ error: 'title and mediaType are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }

    if (tmdbId != null) {
      const existing = await prisma.entry.findFirst({
        where: { tmdbId: Number(tmdbId), mediaType },
      });
      if (existing) {
        return res.status(409).json({
          error: 'Already in your library',
          entry: serializeEntry(existing),
        });
      }
    }

    let season = toNullableInt(currentSeason);
    let episode = toNullableInt(currentEpisode);
    const mark = toNullableString(progressMark);
    let progressUpdatedAt = null;

    if (status === 'watching') {
      if (mediaType === 'tv') {
        if (season == null) season = 1;
        if (episode == null) episode = 1;
      }
      progressUpdatedAt = new Date();
    } else if (season != null || episode != null || mark != null) {
      progressUpdatedAt = new Date();
    }

    const entry = await prisma.entry.create({
      data: {
        tmdbId: tmdbId != null ? Number(tmdbId) : null,
        title: String(title),
        year: year != null ? Number(year) : null,
        mediaType,
        posterPath: posterPath ?? null,
        genres: storeGenres(genres),
        status,
        rating: rating !== undefined ? parseRating(rating) : null,
        notes: notes ?? null,
        currentSeason: mediaType === 'tv' ? season ?? null : null,
        currentEpisode: mediaType === 'tv' ? episode ?? null : null,
        progressMark: mediaType === 'movie' ? mark ?? null : null,
        progressUpdatedAt,
        watchedAt: status === 'watched' ? new Date() : null,
      },
    });

    res.status(201).json(serializeEntry(entry));
  } catch (err) {
    console.error('POST /api/entries', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create entry' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.entry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const data = {};
    const fields = ['title', 'year', 'mediaType', 'posterPath', 'status', 'notes', 'tmdbId'];
    for (const key of fields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.genres !== undefined) data.genres = storeGenres(req.body.genres);

    if (req.body.currentSeason !== undefined) data.currentSeason = toNullableInt(req.body.currentSeason);
    if (req.body.currentEpisode !== undefined) data.currentEpisode = toNullableInt(req.body.currentEpisode);
    if (req.body.progressMark !== undefined) data.progressMark = toNullableString(req.body.progressMark);

    if (data.status !== undefined && !STATUSES.includes(data.status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }

    if (data.status === 'watched' && !existing.watchedAt) {
      data.watchedAt = new Date();
    }
    if (data.status === 'watchlist' || data.status === 'watching') {
      data.watchedAt = null;
    }

    if (req.body.rating !== undefined) {
      data.rating = parseRating(req.body.rating);
      if (data.rating != null) {
        data.status = 'watched';
        if (!existing.watchedAt) data.watchedAt = new Date();
      }
    }

    applyProgressDefaults(data, existing);

    const mediaType = data.mediaType ?? existing.mediaType;
    if (mediaType === 'movie') {
      if (data.currentSeason !== undefined) data.currentSeason = null;
      if (data.currentEpisode !== undefined) data.currentEpisode = null;
    }
    if (mediaType === 'tv' && data.progressMark !== undefined) {
      data.progressMark = null;
    }

    const entry = await prisma.entry.update({
      where: { id: req.params.id },
      data,
    });
    res.json(serializeEntry(entry));
  } catch (err) {
    console.error('PATCH /api/entries/:id', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.entry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    await prisma.entry.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/entries/:id', err);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

export default router;
