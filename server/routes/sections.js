import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
const MEDIA_TYPES = ['movie', 'tv'];
const SECTION_STATUSES = ['watchlist', 'watching'];

function serializeSection(section) {
  return {
    id: section.id,
    name: section.name,
    mediaType: section.mediaType,
    status: section.status,
    sortOrder: section.sortOrder,
    createdAt: section.createdAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const mediaType = req.query.mediaType ? String(req.query.mediaType) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    if (mediaType && !MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (status && !SECTION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be watchlist or watching' });
    }

    const where = {};
    if (mediaType) where.mediaType = mediaType;
    if (status) where.status = status;

    const sections = await prisma.section.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [
        { mediaType: 'asc' },
        { status: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    res.json(sections.map(serializeSection));
  } catch (err) {
    console.error('GET /api/sections', err);
    res.status(500).json({ error: 'Failed to load sections' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const mediaType = String(req.body?.mediaType || '').trim();
    const status = String(req.body?.status || 'watchlist').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (!SECTION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be watchlist or watching' });
    }

    const max = await prisma.section.aggregate({
      where: { mediaType, status },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const section = await prisma.section.create({
      data: { name, mediaType, status, sortOrder },
    });
    res.status(201).json(serializeSection(section));
  } catch (err) {
    console.error('POST /api/sections', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

router.put('/reorder', requireAuth, async (req, res) => {
  try {
    const ids = req.body?.ids;
    const mediaType = String(req.body?.mediaType || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    if (!MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (!SECTION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be watchlist or watching' });
    }

    const existing = await prisma.section.findMany({
      where: { mediaType, status },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s) => s.id));
    if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(String(id)))) {
      return res.status(400).json({
        error: 'ids must include every section for this media type and status exactly once',
      });
    }

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < ids.length; index++) {
        await tx.section.update({
          where: { id: String(ids[index]) },
          data: { sortOrder: index },
        });
      }
    });

    const sections = await prisma.section.findMany({
      where: { mediaType, status },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(sections.map(serializeSection));
  } catch (err) {
    console.error('PUT /api/sections/reorder', err);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name cannot be empty' });
      data.name = name;
    }
    if (req.body.sortOrder !== undefined) {
      const n = Number(req.body.sortOrder);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'sortOrder must be a number' });
      data.sortOrder = Math.trunc(n);
    }

    const section = await prisma.section.update({
      where: { id: req.params.id },
      data,
    });
    res.json(serializeSection(section));
  } catch (err) {
    console.error('PATCH /api/sections/:id', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    await prisma.$transaction([
      prisma.entry.updateMany({
        where: { sectionId: req.params.id },
        data: { sectionId: null },
      }),
      prisma.section.delete({ where: { id: req.params.id } }),
    ]);

    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/sections/:id', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

export default router;
