import crypto from 'crypto';

const COOKIE_NAME = 'cinelog_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getPassword() {
  return process.env.AUTH_PASSWORD?.trim() || '';
}

function getSecret() {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit) return explicit;
  const password = getPassword();
  if (!password) return '';
  return crypto.createHash('sha256').update(`cinelog:${password}`).digest('hex');
}

export function isAuthConfigured() {
  return Boolean(getPassword() && getSecret());
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionToken() {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !isAuthConfigured()) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [version, expRaw, sig] = parts;
  const payload = `${version}.${expRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || '';
}

export function isAuthenticated(req) {
  return verifySessionToken(getSessionTokenFromRequest(req));
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function passwordsMatch(input) {
  const expected = getPassword();
  if (!expected) return false;
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Express middleware — blocks mutating routes when not logged in. */
export function requireAuth(req, res, next) {
  if (!isAuthConfigured()) {
    return res.status(503).json({
      error: 'AUTH_PASSWORD is not configured on the server',
    });
  }
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Login required' });
  }
  return next();
}
