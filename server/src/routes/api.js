import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { databaseStatus } from '../db/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { announcementService } from '../services/announcementService.js';
import { adminConfigured } from '../services/authService.js';
import { contentService } from '../services/contentService.js';
import { eventService } from '../services/eventService.js';
import { INQUIRY_TYPES, submitInquiry } from '../services/inquiryService.js';
import { mailConfigured } from '../services/mailService.js';
import { sponsorEmbeddabilityService } from '../services/sponsorEmbeddabilityService.js';
import { validateInquiry } from '../utils/validate.js';
import { adminRouter } from './admin.js';
import { publicCouponsRouter } from './coupons.js';

export const apiRouter = Router();

// Content changes rarely: let browsers reuse it briefly, and revalidate in the background.
const cacheable = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  next();
};

// Events and announcements are edited in the admin, so browsers only reuse them briefly.
const shortCacheEvents = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  next();
};

async function withSponsorEmbeddability(event, { lazy = false } = {}) {
  const url = event?.sponsorship?.url;
  if (!url) return event;
  const embeddable = lazy ? sponsorEmbeddabilityService.cachedOrKick(url) : await sponsorEmbeddabilityService.check(url);
  return { ...event, sponsorship: { ...event.sponsorship, embeddable } };
}

apiRouter.get('/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // `storage` shows where announcements and form responses are kept: "mysql" or "file";
  // `database` whether MySQL is reachable right now. `admin` and `email` say whether those features
  // are set up (the host's logs show which settings are missing — never listed here).
  const body = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    storage: config.db.enabled ? 'mysql' : 'file',
    admin: adminConfigured() ? 'ready' : 'not_configured',
    email: mailConfigured() ? 'on' : 'off',
    ui: { version: config.uiVersion, preview: config.uiPreview },
    noindex: config.siteNoindex,
  };
  if (config.db.enabled) body.database = await databaseStatus();
  res.json(body);
});

apiRouter.get('/site', cacheable, async (_req, res) => {
  res.json({ data: await contentService.getSite() });
});

apiRouter.get('/events', shortCacheEvents, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const events = await eventService.listPublished({ status });
  res.json({ data: await Promise.all(events.map((event) => withSponsorEmbeddability(event, { lazy: true }))) });
});

apiRouter.get('/events/featured', shortCacheEvents, async (_req, res) => {
  const { event, reason } = await eventService.getFeatured(await contentService.getSite());
  res.json({ data: await withSponsorEmbeddability(event), reason });
});

apiRouter.get('/events/:slug', shortCacheEvents, async (req, res) => {
  const event = await eventService.getPublishedBySlug(req.params.slug);
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  res.json({ data: await withSponsorEmbeddability(event) });
});

apiRouter.get('/gallery', cacheable, async (_req, res) => {
  res.json({ data: await contentService.getGallery() });
});

apiRouter.get('/committee', cacheable, async (_req, res) => {
  res.json({ data: await contentService.getCommittee() });
});

apiRouter.get('/support', cacheable, async (_req, res) => {
  res.json({ data: await contentService.getSupport() });
});

// Announcements change more often than other content, so they get a shorter cache.
const shortCache = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  next();
};

apiRouter.get('/announcements', shortCache, async (req, res) => {
  if (req.query.ticker === '1') return res.json({ data: await announcementService.listForTicker() });
  const limit = Math.min(50, Math.max(0, Number.parseInt(req.query.limit, 10) || 0)) || undefined;
  res.json({ data: await announcementService.listPublished({ limit }) });
});

apiRouter.get('/announcements/:slug', shortCache, async (req, res) => {
  const item = await announcementService.getPublishedBySlug(req.params.slug);
  if (!item) throw new HttpError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.');
  res.json({ data: item });
});

apiRouter.use('/admin', adminRouter);
apiRouter.use('/coupons', publicCouponsRouter);

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many messages from this device. Please try again a little later.' },
    }),
});

apiRouter.post('/inquiries', inquiryLimiter, express.json({ limit: '16kb' }), async (req, res) => {
  // Honeypot: real visitors never see or fill the "website" field.
  if (req.body?.website) {
    return res.status(201).json({ data: { id: 'ok' } });
  }

  const { value, errors } = validateInquiry(req.body, Object.keys(INQUIRY_TYPES));
  if (errors) throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', errors);

  const result = await submitInquiry(value, { ip: req.ip, userAgent: req.get('user-agent') });
  res.status(201).json({ data: result });
});

apiRouter.use((req, _res) => {
  throw new HttpError(404, 'NOT_FOUND', `No API route for ${req.method} ${req.baseUrl}${req.path}`);
});
