import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'data');
const outFile = path.join(outDir, 'entries-export.json');

mkdirSync(outDir, { recursive: true });

const entries = await prisma.entry.findMany({ orderBy: { addedAt: 'asc' } });
writeFileSync(outFile, JSON.stringify(entries, null, 2));
console.log(`Exported ${entries.length} entries → ${outFile}`);

await prisma.$disconnect();
