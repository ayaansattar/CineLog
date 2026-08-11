import { Router } from 'express';
import prisma from '../db.js';
import { serializeEntry, serializeEntries, storeGenres } from '../utils.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
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
    } = req.body;

    if (!title || !mediaType) {
      return res.status(400).json({ error: 'title and mediaType are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (!['watchlist', 'watched'].includes(status)) {
      return res.status(400).json({ error: 'status must be watchlist or watched' });
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

    const entry = await prisma.entry.create({
      data: {
        tmdbId: tmdbId != null ? Number(tmdbId) : null,
        title: String(title),
        year: year != null ? Number(year) : null,
        mediaType,
        posterPath: posterPath ?? null,
        genres: storeGenres(genres),
        status,
        rating: rating != null ? Number(rating) : null,
        notes: notes ?? null,
        watchedAt: status === 'watched' ? new Date() : null,
      },
    });

    res.status(201).json(serializeEntry(entry));
  } catch (err) {
    console.error('POST /api/entries', err);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.entry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const data = {};
    const fields = ['title', 'year', 'mediaType', 'posterPath', 'status', 'rating', 'notes', 'tmdbId'];
    for (const key of fields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.genres !== undefined) data.genres = storeGenres(req.body.genres);

    if (data.status === 'watched' && !existing.watchedAt) {
      data.watchedAt = new Date();
    }
    if (data.status === 'watchlist') {
      data.watchedAt = null;
    }
    if (data.rating != null && existing.status !== 'watched' && data.status !== 'watchlist') {
      data.status = 'watched';
      if (!existing.watchedAt) data.watchedAt = new Date();
    }

    const entry = await prisma.entry.update({
      where: { id: req.params.id },
      data,
    });
    res.json(serializeEntry(entry));
  } catch (err) {
    console.error('PATCH /api/entries/:id', err);
    res.status(500).json({ error: 'Failed to update entry' });
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
