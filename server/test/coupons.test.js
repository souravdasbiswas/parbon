import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// No database configured: the coupon feature must switch itself off without breaking anything.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-coupons-'));
const PASSWORD = 'durga-maa-ki-joi-2026';
const PIN = '482913';
const hash = (secret) => {
  const salt = randomBytes(16);
  const h = scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`;
};
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  MEDIA_DIR: path.join(tmp, 'media'),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: hash(PASSWORD),
  SCANNER_PIN_HASH: hash(PIN),
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
  DB_NAME: '',
  DB_USER: '',
});

const { createApp } = await import('../src/app.js');
const { validateCouponEvent, validateCouponType, validateDesign, validateRegistration } = await import('../src/utils/validateCoupons.js');
const { parseScanInput, normaliseCode, formatCode, newCode, registrationState, attendanceOf } = await import('../src/services/couponService.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const request = (p, { method = 'GET', body, cookie } = {}) =>
  fetch(`${base}${p}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: base },
    body: body ? JSON.stringify(body) : undefined,
  });

const qr = { id: 'qr', type: 'qr', x: 10, y: 10, w: 100, h: 100 };

describe('coupon validation', () => {
  const event = {
    title: { en: 'Durga Puja 2026', bn: 'দুর্গোৎসব' },
    startsAt: '2026-10-16T04:30:00.000Z',
    endsAt: '2026-10-21T17:30:00.000Z',
    totalQuota: 500,
  };

  it('accepts a minimal event and fills sensible defaults', () => {
    const { value, errors } = validateCouponEvent(event);
    assert.equal(errors, undefined);
    assert.equal(value.slug, 'durga-puja-2026');
    assert.equal(value.status, 'draft');
    assert.equal(value.linksExpireAt, event.endsAt);
    assert.equal(value.maxAttendees, 10);
    assert.equal(value.payment.allowTxn, true);
    assert.equal(value.payment.allowPledge, true);
  });

  it('rejects impossible events', () => {
    const { errors } = validateCouponEvent({ ...event, endsAt: event.startsAt, totalQuota: 0, payment: { allowTxn: false, allowPledge: false, upiId: 'nope' } });
    assert.ok(errors.endsAt);
    assert.ok(errors.totalQuota);
    assert.ok(errors['payment.allowPledge']);
    assert.ok(errors['payment.upiId']);
  });

  it('validates coupon types', () => {
    assert.equal(validateCouponType({ name: { en: 'Entry pass' }, kind: 'entry', price: 200, quota: 300 }).value.price, 200);
    const { errors } = validateCouponType({ name: { en: 'x' }, price: -5, quota: 0 });
    assert.ok(errors['name.en'] && errors.price && errors.quota);
    assert.equal(validateCouponType({ name: { en: 'Bhog' }, quota: '' }).value.quota, null);
  });

  it('cleans designs: drops unknown elements and unsafe images, clamps numbers, requires a QR', () => {
    const { value } = validateDesign({
      width: 99999,
      background: { color: 'red; background:url(x)', image: { src: 'https://evil.example/x.png' } },
      elements: [
        qr,
        { type: 'script', x: 1 },
        { type: 'image', src: 'javascript:alert(1)' },
        { type: 'image', src: '/brand/logo-480.png', x: 5 },
        { type: 'text', text: 'Hello {{name}}', font: 'comic', size: 9999, color: 'url(x)' },
      ],
    });
    assert.equal(value.width, 2400);
    assert.equal(value.background.color, '#fbf6ee');
    assert.equal(value.background.image, null);
    assert.deepEqual(value.elements.map((e) => e.type), ['qr', 'image', 'text']);
    const text = value.elements[2];
    assert.equal(text.font, 'body');
    assert.equal(text.size, 600);
    assert.equal(text.color, '#231a15');
    assert.ok(validateDesign({ elements: [{ type: 'text', text: 'no qr' }] }).errors.design);
  });

  it('validates registrations', () => {
    const ok = validateRegistration({
      name: 'Ananya Sen',
      email: 'Ananya@Example.com',
      phone: '+91 98765 43210',
      attendees: 4,
      items: [{ typeId: 't1', quantity: 4 }, { typeId: 't2', quantity: 0 }],
      paymentMethod: 'txn',
      txnRef: 'UPI123456',
    });
    assert.equal(ok.value.email, 'ananya@example.com');
    assert.deepEqual(ok.value.items, [{ typeId: 't1', quantity: 4 }]);

    const bad = validateRegistration({ name: 'A', email: 'x', phone: '123', attendees: 0, items: [], paymentMethod: 'txn' });
    for (const field of ['name', 'email', 'phone', 'attendees', 'items', 'txnRef']) assert.ok(bad.errors[field], field);

    // Admins entering walk-ins may leave out email and phone.
    const walkIn = validateRegistration({ name: 'Walk-in guest', attendees: 2, items: [{ typeId: 't1', quantity: 2 }], paymentMethod: 'pledge' }, { admin: true });
    assert.equal(walkIn.errors, undefined);
  });
});

describe('coupon codes and states', () => {
  it('makes readable codes and understands scans, links and typed codes', () => {
    const code = newCode();
    assert.match(code, /^[2-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal(formatCode('ABCD2345'), 'ABCD-2345');
    assert.equal(normaliseCode(' abcd-2345 '), 'ABCD2345');
    const token = 'AbCdEfGhIjKlMnOpQrStUv';
    assert.deepEqual(parseScanInput(`https://parbon.in/c/${token}`), { token });
    assert.deepEqual(parseScanInput(`https://parbon.in/c/${token}?x=1`), { token });
    assert.deepEqual(parseScanInput(token), { token });
    assert.deepEqual(parseScanInput('abcd 2345'), { code: 'ABCD2345' });
    assert.equal(parseScanInput('hello'), null);
  });

  it('works out whether registration is open', () => {
    const e = { status: 'open', startsAt: '2026-10-16T00:00:00Z', endsAt: '2026-10-21T00:00:00Z', linksExpireAt: '2026-10-22T00:00:00Z' };
    assert.equal(registrationState(e, '2026-10-01T00:00:00Z'), 'open');
    assert.equal(registrationState({ ...e, registrationClosesAt: '2026-10-10T00:00:00Z' }, '2026-10-11T00:00:00Z'), 'closed');
    assert.equal(registrationState(e, '2026-10-21T00:00:01Z'), 'over');
    assert.equal(registrationState({ ...e, status: 'draft' }, '2026-10-01T00:00:00Z'), 'draft');
  });

  it('summarises attendance from entry coupons', () => {
    const c = (kind, quantity, usedCount, status = 'active') => ({ kind, quantity, usedCount, status });
    assert.equal(attendanceOf([c('entry', 4, 0), c('food', 2, 2)]), 'none');
    assert.equal(attendanceOf([c('entry', 4, 2)]), 'partial');
    assert.equal(attendanceOf([c('entry', 4, 4), c('food', 2, 0)]), 'in');
    assert.equal(attendanceOf([c('food', 2, 1)]), 'partial');
    assert.equal(attendanceOf([c('entry', 4, 0, 'cancelled')]), 'cancelled');
  });
});

describe('coupons without a database', () => {
  it('reports the feature as off and lists no events', async () => {
    assert.deepEqual((await (await request('/api/coupons/status')).json()).data, { enabled: false, mailEnabled: false });
    assert.deepEqual((await (await request('/api/coupons/events')).json()).data, []);
  });

  it('answers 503 for registration and coupon links instead of crashing', async () => {
    const res = await request('/api/coupons/events/durga-puja/register', { method: 'POST', body: {} });
    assert.equal(res.status, 422); // validation happens first
    const coupon = await request('/api/coupons/c/AbCdEfGhIjKlMnOpQrStUv');
    assert.equal(coupon.status, 503);
    assert.equal((await coupon.json()).error.code, 'COUPONS_DISABLED');
  });

  it('keeps coupon admin and scanner endpoints behind sign-in', async () => {
    assert.equal((await request('/api/admin/coupons/events')).status, 401);
    assert.equal((await request('/api/admin/scan/events')).status, 401);
    assert.equal((await request('/api/admin/scan/lookup', { method: 'POST', body: { eventId: 'x', input: 'ABCD2345' } })).status, 401);
  });

  it('signs volunteers in with the scanner PIN, which does not open the admin area', async () => {
    const wrong = await request('/api/admin/scan/login', { method: 'POST', body: { pin: '000000' } });
    assert.equal(wrong.status, 401);
    const res = await request('/api/admin/scan/login', { method: 'POST', body: { pin: PIN } });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    assert.match(res.headers.get('set-cookie'), /Path=\/api\/admin\/scan/);
    assert.equal((await (await request('/api/admin/scan/me', { cookie })).json()).data.role, 'scanner');
    assert.equal((await request('/api/admin/me', { cookie })).status, 401);
    assert.equal((await request('/api/admin/coupons/events', { cookie })).status, 401);
    // Admin sessions can use the scanner too.
    const login = await request('/api/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
    const adminCookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await request('/api/admin/scan/me', { cookie: adminCookie })).json()).data.role, 'admin');
  });

  it('keeps coupon links and the scanner out of search engines', async () => {
    const robots = await (await request('/robots.txt')).text();
    assert.match(robots, /Disallow: \/c\//);
    assert.match(robots, /Disallow: \/scan/);
  });
});
