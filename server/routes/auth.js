import { Router } from 'express';
import {
  clearSessionCookie,
  createSessionToken,
  isAuthConfigured,
  isAuthenticated,
  passwordsMatch,
  setSessionCookie,
} from '../auth.js';

const router = Router();

router.get('/me', (req, res) => {
  res.json({
    configured: isAuthConfigured(),
    authenticated: isAuthenticated(req),
  });
});

router.post('/login', (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: 'AUTH_PASSWORD is not configured on the server' });
  }

  const password = String(req.body?.password || '');
  if (!passwordsMatch(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  res.json({ ok: true, authenticated: true });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true, authenticated: false });
});

export default router;
