import { mkdirSync } from 'fs';
import { dirname, isAbsolute } from 'path';
import { execSync } from 'child_process';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace(/^file:/, '');
  if (isAbsolute(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
  }
}

console.log('Syncing database schema…');
execSync('npx prisma db push', { stdio: 'inherit' });

await import('./index.js');
