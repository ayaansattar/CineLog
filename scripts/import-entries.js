import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inFile = path.join(__dirname, '..', 'data', 'entries-export.json');

if (!existsSync(inFile)) {
  console.error(`Missing ${inFile}. Run: node scripts/export-entries.js`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl || dbUrl.startsWith('file:')) {
  console.error('DATABASE_URL must be a Postgres URL (Neon). Update .env first.');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inFile, 'utf8'));
if (!Array.isArray(raw) || raw.length === 0) {
  console.error('Export file is empty.');
  process.exit(1);
}

function mapEntry(e) {
  return {
    id: e.id,
    tmdbId: e.tmdbId ?? null,
    title: e.title,
    year: e.year ?? null,
    mediaType: e.mediaType,
    posterPath: e.posterPath ?? null,
    genres: e.genres ?? null,
    status: e.status,
    rating: e.rating ?? null,
    notes: e.notes ?? null,
    currentSeason: e.currentSeason ?? null,
    currentEpisode: e.currentEpisode ?? null,
    progressMark: e.progressMark ?? null,
    progressUpdatedAt: e.progressUpdatedAt ? new Date(e.progressUpdatedAt) : null,
    addedAt: e.addedAt ? new Date(e.addedAt) : new Date(),
    watchedAt: e.watchedAt ? new Date(e.watchedAt) : null,
  };
}

const existing = await prisma.entry.count();
if (existing > 0) {
  console.log(`Database already has ${existing} entries. Skipping rows that already exist (by id).`);
}

const rows = raw.map(mapEntry);
const BATCH = 100;
let created = 0;
let skipped = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  for (const row of chunk) {
    try {
      await prisma.entry.create({ data: row });
      created += 1;
    } catch (err) {
      if (err.code === 'P2002') {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }
  process.stdout.write(`\rImported ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
}

console.log(`\nDone. created=${created} skipped=${skipped} totalExport=${rows.length}`);
await prisma.$disconnect();
