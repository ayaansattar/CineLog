import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

function serializeSection(section) {
  return {
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    createdAt: section.createdAt,
  };
}

router.get('/', async (_req, res) => {
  try {
    const sections = await prisma.section.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
    if (!name) return res.status(400).json({ error: 'name is required' });

    const max = await prisma.section.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const section = await prisma.section.create({
      data: { name, sortOrder },
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
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const existing = await prisma.section.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((s) => s.id));
    if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(String(id)))) {
      return res.status(400).json({ error: 'ids must include every section exactly once' });
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
