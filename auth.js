// auth.js — Autenticación sin dependencias externas (solo node:crypto).
// Contraseñas con scrypt + sal; sesiones como token firmado con HMAC-SHA256.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'fialo-dev-secret-cambia-esto-en-produccion';
const SESSION_DIAS = 7;
export const COOKIE_NAME = 'fialo_session';

// ---- Contraseñas ----
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = scryptSync(String(pw), salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && timingSafeEqual(orig, test);
}

// ---- Tokens de sesión ----
export function signToken(payload) {
  const data = { ...payload, exp: Date.now() + SESSION_DIAS * 86400000 };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- Cookies (parseo y emisión sin dependencias) ----
export function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(req, res, token) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https');
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DIAS * 86400}; SameSite=Lax${secure ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}
