import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { requireAdmin, requireScanner } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { SCANNER_COOKIE, checkScannerPin, createScannerToken, scannerConfigured } from '../services/authService.js';
import { sendCouponEmail } from '../services/couponMail.js';
import { couponService, couponsEnabled } from '../services/couponService.js';
import { mailConfigured } from '../services/mailService.js';
import { toCsv } from '../utils/csv.js';
import {
  validateCouponEvent,
  validateCouponType,
  validateDesign,
  validatePaymentUpdate,
  validateRegistration,
} from '../utils/validateCoupons.js';

const limited = (limit, message, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
  });

const check = ({ value, errors }) => {
  if (errors) throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', errors);
  return value;
};

const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Emails coupons without ever failing the request that issued them. */
async function emailCoupons(result) {
  try {
    if (!(await sendCouponEmail(result))) return false;
    await couponService.markEmailed(result.registration.id);
    return true;
  } catch (error) {
    console.error('[parbon] coupon email failed:', error.message);
    return false;
  }
}

const issuedResponse = ({ registration, coupons }, emailed) => ({
  registration: {
    id: registration.id,
    name: registration.name,
    attendees: registration.attendees,
    amountDue: registration.amountDue,
    paymentMethod: registration.paymentMethod,
    paymentStatus: registration.paymentStatus,
  },
  coupons: coupons.map((c) => ({ code: c.code, url: c.url, token: c.token, quantity: c.quantity, typeName: c.type?.name, kind: c.type?.kind })),
  emailed,
});

// ── Public: /api/coupons ──

export const publicCouponsRouter = Router();
publicCouponsRouter.use(noStore);

publicCouponsRouter.get('/status', (_req, res) => {
  res.json({ data: { enabled: couponsEnabled(), mailEnabled: couponsEnabled() && mailConfigured() } });
});

publicCouponsRouter.get('/events', async (req, res) => {
  const linkedEventSlug = typeof req.query.linked === 'string' ? req.query.linked : undefined;
  res.json({ data: await couponService.listOpenEvents({ linkedEventSlug }) });
});

publicCouponsRouter.get('/events/:slug', async (req, res) => {
  const event = await couponService.getPublicEvent(req.params.slug);
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  res.json({ data: { ...event, mailEnabled: mailConfigured() } });
});

publicCouponsRouter.post(
  '/events/:slug/register',
  // Generous: many phones on Indian mobile networks share one public IP (carrier-grade NAT).
  limited(30, 'Too many registrations from this network. Please try again a little later.'),
  express.json({ limit: '16kb' }),
  async (req, res) => {
    // Honeypot: real visitors never see or fill the "website" field.
    if (req.body?.website) throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the form and try again.');
    const value = check(validateRegistration(req.body));
    const result = await couponService.register(req.params.slug, value, { ip: req.ip, userAgent: req.get('user-agent') });
    const emailed = value.sendEmail ? await emailCoupons(result) : false;
    res.status(201).json({ data: issuedResponse(result, emailed) });
  },
);

publicCouponsRouter.get('/c/:token', limited(120, 'Too many requests. Please wait a moment.', 60 * 1000), async (req, res) => {
  const coupon = await couponService.getCouponByToken(req.params.token);
  if (!coupon) throw new HttpError(404, 'COUPON_NOT_FOUND', 'This coupon link is not valid.');
  res.json({ data: coupon });
});

// ── Admin: /api/admin/coupons ──

export const adminCouponsRouter = Router();
adminCouponsRouter.use(requireAdmin);
const json = express.json({ limit: '256kb' });

adminCouponsRouter.get('/status', (_req, res) => {
  res.json({ data: { enabled: couponsEnabled(), mailEnabled: mailConfigured(), scannerEnabled: scannerConfigured() } });
});

adminCouponsRouter.get('/events', async (_req, res) => {
  res.json({ data: await couponService.listEvents() });
});

adminCouponsRouter.post('/events', json, async (req, res) => {
  res.status(201).json({ data: await couponService.createEvent(check(validateCouponEvent(req.body))) });
});

adminCouponsRouter.get('/events/:id', async (req, res) => {
  const event = await couponService.getEvent(req.params.id);
  if (!event) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
  res.json({ data: event });
});

adminCouponsRouter.put('/events/:id', json, async (req, res) => {
  res.json({ data: await couponService.updateEvent(req.params.id, check(validateCouponEvent(req.body))) });
});

adminCouponsRouter.delete('/events/:id', async (req, res) => {
  if (!(await couponService.deleteEvent(req.params.id))) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
  res.status(204).end();
});

adminCouponsRouter.post('/events/:id/types', json, async (req, res) => {
  res.status(201).json({ data: await couponService.createType(req.params.id, check(validateCouponType(req.body))) });
});

adminCouponsRouter.put('/types/:id', json, async (req, res) => {
  res.json({ data: await couponService.updateType(req.params.id, check(validateCouponType(req.body))) });
});

adminCouponsRouter.put('/types/:id/design', json, async (req, res) => {
  res.json({ data: await couponService.saveDesign(req.params.id, check(validateDesign(req.body))) });
});

adminCouponsRouter.delete('/types/:id', async (req, res) => {
  if (!(await couponService.deleteType(req.params.id))) throw new HttpError(404, 'NOT_FOUND', 'Coupon type not found.');
  res.status(204).end();
});

adminCouponsRouter.get('/events/:id/registrations', async (req, res) => {
  res.json({ data: await couponService.listRegistrations(req.params.id) });
});

// Walk-ins and phone bookings, entered by an admin (email and phone optional).
adminCouponsRouter.post('/events/:id/registrations', json, async (req, res) => {
  const value = check(validateRegistration(req.body, { admin: true }));
  const result = await couponService.register(req.params.id, value, { admin: true, markPaid: Boolean(req.body?.markPaid) });
  const emailed = value.sendEmail && value.email ? await emailCoupons(result) : false;
  res.status(201).json({ data: issuedResponse(result, emailed) });
});

adminCouponsRouter.put('/registrations/:id/payment', json, async (req, res) => {
  res.json({ data: await couponService.updatePayment(req.params.id, check(validatePaymentUpdate(req.body)), req.admin.username) });
});

adminCouponsRouter.post('/registrations/:id/cancel', json, async (req, res) => {
  res.json({ data: await couponService.cancelRegistration(req.params.id, req.body?.reason) });
});

adminCouponsRouter.post('/registrations/:id/resend', async (req, res) => {
  const registration = await couponService.getRegistration(req.params.id);
  if (!registration) throw new HttpError(404, 'NOT_FOUND', 'Registration not found.');
  if (!mailConfigured()) throw new HttpError(503, 'MAIL_DISABLED', 'Email is not set up on this server.');
  if (!registration.email) throw new HttpError(422, 'NO_EMAIL', 'This registration has no email address.');
  const event = await couponService.getEvent(registration.eventId);
  const sent = await emailCoupons({ event, registration, coupons: registration.coupons });
  if (!sent) throw new HttpError(502, 'MAIL_FAILED', 'The email could not be sent. Please try again later.');
  res.json({ data: { emailed: true } });
});

adminCouponsRouter.post('/coupons/:id/cancel', json, async (req, res) => {
  res.json({ data: await couponService.cancelCoupon(req.params.id, req.body?.reason) });
});

adminCouponsRouter.post('/coupons/:id/reissue', async (req, res) => {
  res.json({ data: await couponService.reissueCoupon(req.params.id) });
});

// India Standard Time has no daylight saving, so a fixed +05:30 offset is exact.
const toIst = (iso) => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time + 330 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
};
const ATTENDANCE = { in: 'All in', partial: 'Partly in', none: 'Not in yet', cancelled: 'Cancelled' };
const PAYMENT = { to_verify: 'To verify', pledged: 'Pay at counter', paid: 'Paid', rejected: 'Rejected', free: 'Free' };

const CSV_COLUMNS = [
  { header: 'Registered (IST)', value: (r) => toIst(r.createdAt) },
  { header: 'Name', value: (r) => r.name },
  { header: 'Email', value: (r) => r.email },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Attendees', value: (r) => r.attendees },
  {
    header: 'Coupons',
    value: (r) =>
      r.coupons
        .filter((c) => c.status !== 'replaced')
        .map((c) => `${c.typeName?.en || 'Coupon'} ×${c.quantity} [${c.code}] ${c.usedCount}/${c.quantity} in${c.status === 'cancelled' ? ' (cancelled)' : ''}`)
        .join('; '),
  },
  { header: 'Amount (₹)', value: (r) => r.amountDue },
  { header: 'Payment', value: (r) => PAYMENT[r.paymentStatus] || r.paymentStatus },
  { header: 'Transaction ID', value: (r) => r.txnRef },
  { header: 'Attendance', value: (r) => ATTENDANCE[r.attendance] || r.attendance },
  { header: 'Source', value: (r) => r.source },
  { header: 'Notes', value: (r) => r.adminNote },
];

adminCouponsRouter.get('/events/:id/export.csv', async (req, res) => {
  const event = await couponService.getEvent(req.params.id);
  if (!event) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
  const rows = await couponService.listRegistrations(req.params.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${event.slug}-attendees-${toIst(new Date().toISOString()).slice(0, 10)}.csv"`);
  res.send(toCsv(CSV_COLUMNS, rows));
});

// ── Gate scanner: /api/admin/scan (admin session or volunteer PIN session) ──

export const scanRouter = Router();

const scannerCookie = () => ({ httpOnly: true, sameSite: 'strict', secure: config.isProduction, path: '/api/admin/scan' });

scanRouter.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many wrong PINs. Please wait 15 minutes.' } }),
  }),
  express.json({ limit: '2kb' }),
  async (req, res) => {
    if (!scannerConfigured()) throw new HttpError(503, 'SCANNER_DISABLED', 'The scanner PIN is not set up. Sign in as admin instead.');
    if (!(await checkScannerPin(String(req.body?.pin || '').trim()))) throw new HttpError(401, 'INVALID_PIN', 'Incorrect PIN.');
    res.cookie(SCANNER_COOKIE, createScannerToken(), { ...scannerCookie(), maxAge: config.scanner.sessionHours * 3600 * 1000 });
    res.json({ data: { role: 'scanner' } });
  },
);

scanRouter.post('/logout', (_req, res) => {
  res.clearCookie(SCANNER_COOKIE, scannerCookie());
  res.json({ data: { ok: true } });
});

scanRouter.get('/me', requireScanner, (req, res) => {
  res.json({ data: { role: req.scanner.role, username: req.scanner.username, pinEnabled: scannerConfigured() } });
});

scanRouter.get('/events', requireScanner, async (_req, res) => {
  res.json({ data: await couponService.scannerEvents() });
});

scanRouter.get('/events/:id/stats', requireScanner, async (req, res) => {
  res.json({ data: await couponService.scannerStats(req.params.id) });
});

const small = express.json({ limit: '4kb' });
const eventIdOf = (req) => {
  const id = String(req.body?.eventId || '');
  if (!id) throw new HttpError(422, 'VALIDATION_FAILED', 'Choose the event you are scanning for.');
  return id;
};

scanRouter.post('/lookup', requireScanner, small, async (req, res) => {
  res.json({ data: await couponService.lookup(eventIdOf(req), req.body?.input) });
});

scanRouter.post('/checkin', requireScanner, small, async (req, res) => {
  const count = Number(req.body?.count);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new HttpError(422, 'VALIDATION_FAILED', 'Choose how many people to let in.');
  res.json({ data: await couponService.checkIn(eventIdOf(req), String(req.body?.couponId || ''), count, req.scanner.username) });
});

scanRouter.post('/undo', requireScanner, small, async (req, res) => {
  res.json({ data: await couponService.undoCheckIn(eventIdOf(req), String(req.body?.checkinId || '')) });
});

scanRouter.post('/mark-paid', requireScanner, small, async (req, res) => {
  res.json({ data: await couponService.markPaidAtGate(eventIdOf(req), String(req.body?.couponId || ''), req.scanner.username) });
});
