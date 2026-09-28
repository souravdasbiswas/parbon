import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../middleware/errorHandler.js';
import { announcementService } from '../services/announcementService.js';
import { contentService } from '../services/contentService.js';
import { INQUIRY_TYPES, submitInquiry } from '../services/inquiryService.js';
import { validateInquiry } from '../utils/validate.js';
import { adminRouter } from './admin.js';

export const apiRouter = Router();

// Content changes rarely: let browsers reuse it briefly, and revalidate in the background.
const cacheable = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  next();
};

apiRouter.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

apiRouter.get('/site', cacheable, async (_req, res) => {
  res.json({ data: await contentService.getSite() });
});

apiRouter.get('/events', cacheable, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ data: await contentService.listEvents({ status }) });
});

apiRouter.get('/events/:slug', cacheable, async (req, res) => {
  const event = await contentService.getEvent(req.params.slug);
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  res.json({ data: event });
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
