import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { storageReport } from '../db/index.js';
import { requireAdmin, sameOrigin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { announcementService } from '../services/announcementService.js';
import { SESSION_COOKIE, adminConfigured, checkCredentials, createSessionToken } from '../services/authService.js';
import { queryResponses } from '../services/responsesService.js';
import { saveAnnouncementImage } from '../services/uploadService.js';
import { toCsv } from '../utils/csv.js';
import { validateAnnouncement } from '../utils/validateAnnouncement.js';
import { adminCouponsRouter, scanRouter } from './coupons.js';

export const adminRouter = Router();

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: config.isProduction,
  path: '/api/admin',
});

adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
adminRouter.use(sameOrigin);

adminRouter.use('/coupons', adminCouponsRouter);
adminRouter.use('/scan', scanRouter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait 15 minutes.' } }),
});

adminRouter.post('/login', loginLimiter, express.json({ limit: '4kb' }), async (req, res) => {
  if (!adminConfigured()) {
    throw new HttpError(503, 'ADMIN_DISABLED', 'Admin sign-in is not configured on this server.');
  }
  const { username = '', password = '' } = req.body || {};
  if (!(await checkCredentials(String(username).trim(), String(password)))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');
  }
  res.cookie(SESSION_COOKIE, createSessionToken(config.admin.username), {
    ...cookieOptions(),
    maxAge: config.admin.sessionHours * 3600 * 1000,
  });
  res.json({ data: { username: config.admin.username } });
});

adminRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.json({ data: { ok: true } });
});

adminRouter.get('/me', requireAdmin, (req, res) => {
  res.json({ data: { username: req.admin.username, expiresAt: req.admin.expiresAt } });
});

adminRouter.get('/announcements', requireAdmin, async (_req, res) => {
  res.json({ data: await announcementService.listAll() });
});

adminRouter.get('/announcements/:id', requireAdmin, async (req, res) => {
  const item = await announcementService.getById(req.params.id);
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  res.json({ data: item });
});

const parseAnnouncement = (req) => {
  const { value, errors } = validateAnnouncement(req.body);
  if (errors) throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', errors);
  return value;
};

adminRouter.post('/announcements', requireAdmin, express.json({ limit: '64kb' }), async (req, res) => {
  const created = await announcementService.create(parseAnnouncement(req), req.admin.username);
  res.status(201).json({ data: created });
});

adminRouter.put('/announcements/:id', requireAdmin, express.json({ limit: '64kb' }), async (req, res) => {
  const updated = await announcementService.update(req.params.id, parseAnnouncement(req));
  if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  res.json({ data: updated });
});

adminRouter.delete('/announcements/:id', requireAdmin, async (req, res) => {
  if (!(await announcementService.remove(req.params.id))) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found.');
  res.status(204).end();
});

// Images arrive as base64 data URLs (already resized in the browser), keeping the server dependency-free.
adminRouter.post('/uploads', requireAdmin, express.json({ limit: '8mb' }), async (req, res) => {
  const saved = await saveAnnouncementImage(req.body?.dataUrl);
  res.status(201).json({ data: saved });
});

// ── Contact-form responses (read-only view of inquiries.ndjson) ──

adminRouter.get('/responses', requireAdmin, async (req, res) => {
  res.json({ data: await queryResponses(req.query) });
});

// India Standard Time has no daylight saving, so a fixed +05:30 offset is exact.
const IST_OFFSET_MS = 330 * 60 * 1000;
const toIst = (iso) => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time + IST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
};

const CSV_COLUMNS = [
  { header: 'Received (IST)', value: (r) => toIst(r.createdAt) },
  { header: 'Received (ISO)', value: (r) => r.createdAt },
  { header: 'Type', value: (r) => r.typeLabel },
  { header: 'Name', value: (r) => r.name },
  { header: 'Email', value: (r) => r.email },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Message', value: (r) => r.message },
  { header: 'Reference ID', value: (r) => r.id },
  { header: 'IP address', value: (r) => r.ip },
  { header: 'Browser (user agent)', value: (r) => r.userAgent },
];

adminRouter.get('/responses/export.csv', requireAdmin, async (req, res) => {
  const { items } = await queryResponses(req.query);
  const date = toIst(new Date().toISOString()).slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="parbon-responses-${date}.csv"`);
  res.send(toCsv(CSV_COLUMNS, items));
});

// ── Storage status (to check the MySQL migration without server access) ──
adminRouter.get('/storage', requireAdmin, async (_req, res) => {
  if (!config.db.enabled) {
    return res.json({ data: { storage: 'file', path: config.paths.storage } });
  }
  try {
    res.json({ data: { storage: 'mysql', status: 'connected', ...(await storageReport()) } });
  } catch (error) {
    res.status(503).json({ data: { storage: 'mysql', status: 'unavailable', error: error.message } });
  }
});
