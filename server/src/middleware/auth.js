import { config } from '../config.js';
import { HttpError } from './errorHandler.js';
import { SESSION_COOKIE, verifySessionToken } from '../services/authService.js';

export function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Rejects unauthenticated requests; attaches req.admin on success. */
export function requireAdmin(req, _res, next) {
  const session = verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!session) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
  req.admin = session;
  next();
}

/**
 * CSRF defence for cookie-authenticated, state-changing requests: the browser's
 * Origin (or Referer) must match this site. Works together with SameSite=Strict cookies.
 */
export function sameOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  let origin = req.get('origin');
  if (!origin && req.get('referer')) {
    try {
      origin = new URL(req.get('referer')).origin;
    } catch {
      origin = 'invalid';
    }
  }
  // Behind a reverse proxy the Host header may differ, so SITE_URL is accepted as well.
  const allowed = new Set([`${req.protocol}://${req.get('host')}`, new URL(config.siteUrl).origin, ...config.corsOrigins]);
  if (origin && !allowed.has(origin)) {
    return next(new HttpError(403, 'BAD_ORIGIN', 'Request origin not allowed.'));
  }
  next();
}
