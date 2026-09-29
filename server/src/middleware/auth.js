import { config } from '../config.js';
import { HttpError } from './errorHandler.js';
import { logSignIn } from '../services/authLog.js';
import { SCANNER_COOKIE, SESSION_COOKIE, verifyGateToken, verifySessionToken } from '../services/authService.js';
import { gateUserService } from '../services/gateUserService.js';

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
 * For the gate scanner: a website admin (always allowed, every event and permission) or a gate
 * volunteer whose account is still active and hasn't been reset since they signed in.
 * Attaches req.scanner = { role, username, name, canMarkPaid, canUndo, eventIds }.
 */
export async function requireScanner(req, _res, next) {
  try {
    const admin = verifySessionToken(readCookie(req, SESSION_COOKIE));
    if (admin) {
      req.scanner = { role: 'admin', username: admin.username, name: 'Admin', canMarkPaid: true, canUndo: true, eventIds: [] };
      return next();
    }
    const token = verifyGateToken(readCookie(req, SCANNER_COOKIE));
    const user = token && (await gateUserService.forSession(token.uid, token.version));
    if (!user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to the scanner.'));
    req.scanner = { role: 'gate', id: user.id, username: user.username, name: user.name, canMarkPaid: user.canMarkPaid, canUndo: user.canUndo, eventIds: user.eventIds };
    next();
  } catch (error) {
    next(error);
  }
}

/** True when this scanner session may work on the event (admins and unrestricted volunteers: any). */
export const canScanEvent = (scanner, eventId) => scanner.role === 'admin' || !scanner.eventIds.length || scanner.eventIds.includes(eventId);

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
    if (/\/login$/.test(req.path)) {
      logSignIn({ who: req.path.startsWith('/scan') ? 'gate' : 'admin', ok: false, reason: 'bad_origin', ip: req.ip, details: { origin, expected: [...allowed].join(',') }, throttle: true });
    }
    return next(new HttpError(403, 'BAD_ORIGIN', 'Request origin not allowed.'));
  }
  next();
}
