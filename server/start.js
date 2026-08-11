import { execSync } from 'child_process';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  console.error(
    'DATABASE_URL must be a Postgres connection string (Neon). Set it in the Render Environment tab.'
  );
  process.exit(1);
}

console.log('Syncing database schema…');
execSync('npx prisma db push', { stdio: 'inherit' });

await import('./index.js');
