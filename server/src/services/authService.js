import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';

const scrypt = promisify(scryptCb);
const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const SESSION_COOKIE = 'parbon_admin';

/** Returns "scrypt$N$r$p$saltB64$hashB64". */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(password).normalize('NFKC'), salt, KEYLEN, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(String(password).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export const adminConfigured = () =>
  Boolean(config.admin.username && config.admin.passwordHash && config.admin.sessionSecret.length >= 32);

const sign = (payload) => createHmac('sha256', config.admin.sessionSecret).update(payload).digest('base64url');

/** Stateless signed session token: base64url(json).signature */
export function createSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + config.admin.sessionHours * 3600 * 1000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !adminConfigured()) return null;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    if (data.u !== config.admin.username) return null;
    return { username: data.u, expiresAt: data.exp };
  } catch {
    return null;
  }
}

export async function checkCredentials(username, password) {
  if (!adminConfigured()) return false;
  // Always run the (slow) hash check so timing doesn't reveal whether the username exists.
  const passwordOk = await verifyPassword(password, config.admin.passwordHash);
  return passwordOk && safeEqual(username, config.admin.username);
}
