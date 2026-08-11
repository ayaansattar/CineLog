import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../server/db.js';
import { importLetterboxdCsv } from '../server/importLetterboxd.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}

function resolveExportDir() {
  const dirArg = argValue('--dir');
  if (dirArg) {
    return path.isAbsolute(dirArg) ? dirArg : path.join(rootDir, dirArg);
  }

  // Prefer newest extracted Letterboxd export folder under data/
  if (fs.existsSync(dataDir)) {
    const exports = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('letterboxd-'))
      .map((d) => path.join(dataDir, d.name))
      .sort()
      .reverse();
    if (exports.length) return exports[0];
  }

  return null;
}

async function importFile(filePath, status, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`\nSkipping ${label}: not found (${path.basename(filePath)})`);
    return null;
  }
  const csvText = fs.readFileSync(filePath, 'utf8');
  // Empty-ish file (header only)
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    console.log(`\nSkipping ${label}: no rows`);
    return null;
  }

  console.log(`\n=== ${label} (${status}) — ${path.basename(filePath)} ===`);
  const summary = await importLetterboxdCsv(csvText, status);
  console.log(
    `Summary: added ${summary.added}, skipped ${summary.skippedDuplicates}, unmatched ${summary.unmatched}, rows ${summary.total}`
  );
  return summary;
}

const exportDir = resolveExportDir();
const singleFile = argValue('--file');
const statusOnly = argValue('--status', 'watched');

try {
  if (singleFile) {
    const csvPath = path.isAbsolute(singleFile)
      ? singleFile
      : path.join(rootDir, singleFile);
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV not found: ${csvPath}`);
      process.exit(1);
    }
    console.log(`Importing single file ${csvPath} as ${statusOnly}…`);
    const summary = await importLetterboxdCsv(fs.readFileSync(csvPath, 'utf8'), statusOnly);
    console.log('\nDone.');
    console.log(`  Added: ${summary.added}`);
    console.log(`  Skipped duplicates: ${summary.skippedDuplicates}`);
    console.log(`  Unmatched (no TMDB): ${summary.unmatched}`);
    console.log(`  Rows read: ${summary.total}`);
  } else if (exportDir) {
    console.log(`Using Letterboxd export: ${exportDir}`);
    console.log('Order: ratings (watched+stars) → watched (fill gaps) → watchlist');

    // ratings.csv includes the same films as watched.csv plus Rating — import first
    await importFile(path.join(exportDir, 'ratings.csv'), 'watched', 'Ratings');
    await importFile(path.join(exportDir, 'watched.csv'), 'watched', 'Watched');
    await importFile(path.join(exportDir, 'watchlist.csv'), 'watchlist', 'Watchlist');

    console.log('\nAll imports finished.');
  } else {
    console.error('No Letterboxd export found.');
    console.error('Extract your zip under data/ (e.g. data/letterboxd-…/) or pass --dir=… / --file=…');
    process.exit(1);
  }
} catch (err) {
  console.error('Import failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
