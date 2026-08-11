import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import entriesRouter from './routes/entries.js';
import tmdbRouter from './routes/tmdb.js';
import recsRouter from './routes/recs.js';
import authRouter from './routes/auth.js';
import { isAuthConfigured } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distIndex = path.join(distDir, 'index.html');
const serveFrontend = fs.existsSync(distIndex);
const port = Number(process.env.PORT) || 3001;

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, frontend: serveFrontend, authConfigured: isAuthConfigured() });
});

app.use('/api/auth', authRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/recs', recsRouter);

if (serveFrontend) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(distIndex);
  });
} else {
  console.warn(`Frontend build not found at ${distIndex} — API only`);
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text')
      .send('CineLog API is running, but the frontend build (dist/) is missing.');
  });
}

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CineLog API listening on http://0.0.0.0:${port}`);
  console.log(`Frontend static serve: ${serveFrontend ? 'yes' : 'no'} (${distDir})`);
});
