import { config } from '../config.js';
import { readCookie } from '../middleware/auth.js';
import { SESSION_COOKIE, verifySessionToken } from './authService.js';
import { DEFAULT_UI_VERSION, isAllowedUiVersion } from '../uiVersions.js';

export const UI_PREVIEW_COOKIE = 'parbon_ui';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const previewCookieOptions = () => ({
  httpOnly: false,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
});

const queryUi = (req) => {
  const value = req.query?.ui;
  return typeof value === 'string' ? value.trim() : '';
};

export const hasAdminSession = (req) => Boolean(verifySessionToken(readCookie(req, SESSION_COOKIE)));

export function resolveEffectiveUiVersion(req, res) {
  const fallback = config.uiVersion || DEFAULT_UI_VERSION;
  const canPreview = config.uiPreview || hasAdminSession(req);
  if (!canPreview) return { version: fallback, overrideActive: false, source: 'config' };

  const requested = queryUi(req);
  if (requested === 'reset') {
    res?.clearCookie(UI_PREVIEW_COOKIE, previewCookieOptions());
    return { version: fallback, overrideActive: false, source: 'reset' };
  }

  if (isAllowedUiVersion(requested)) {
    res?.cookie(UI_PREVIEW_COOKIE, requested, { ...previewCookieOptions(), maxAge: THIRTY_DAYS_MS });
    return { version: requested, overrideActive: requested !== fallback, source: 'query' };
  }

  const cookieVersion = readCookie(req, UI_PREVIEW_COOKIE);
  if (isAllowedUiVersion(cookieVersion)) {
    return { version: cookieVersion, overrideActive: cookieVersion !== fallback, source: 'cookie' };
  }

  return { version: fallback, overrideActive: false, source: 'config' };
}
