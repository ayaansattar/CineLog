import { execSync } from 'child_process';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

console.log('Syncing database schema…');
execSync('npx prisma db push', { stdio: 'inherit' });

await import('./index.js');
