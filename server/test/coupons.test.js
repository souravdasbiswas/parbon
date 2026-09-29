import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// No database configured: the coupon feature must switch itself off without breaking anything.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-coupons-'));
const PASSWORD = 'durga-maa-ki-joi-2026';
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
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
  DB_NAME: '',
  DB_USER: '',
});

const { createApp } = await import('../src/app.js');
const { takesPayments, validateCouponEvent, validateCouponType, validateDesign, validateRegistration } = await import('../src/utils/validateCoupons.js');
const { parseScanInput, normaliseCode, formatCode, newCode, registrationState, attendanceOf } = await import('../src/services/couponService.js');
const { validateGateUser, usernameFromName, generatePin, lockoutForTests } = await import('../src/services/gateUserService.js');
const { buildCouponEmail, allowPublicCouponEmail } = await import('../src/services/couponMail.js');

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
    const { errors } = validateCouponEvent({ ...event, endsAt: event.startsAt, totalQuota: 0, payment: { allowTxn: true, allowPledge: false, upiId: 'nope' } });
    assert.ok(errors.endsAt);
    assert.ok(errors.totalQuota);
    assert.ok(errors['payment.upiId']);
  });

  it('allows a free event: no way to pay ticked, and no UPI ID needed', () => {
    const free = validateCouponEvent({ ...event, payment: { allowTxn: false, allowPledge: false, upiId: 'not-checked-when-unused' } });
    assert.equal(free.errors, undefined, JSON.stringify(free.errors));
    assert.deepEqual([free.value.payment.allowTxn, free.value.payment.allowPledge], [false, false]);
    assert.equal(takesPayments(free.value.payment), false);
    assert.equal(takesPayments({ allowTxn: false, allowPledge: true }), true);
    assert.equal(takesPayments({}), true, 'older events without the setting take payments');
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

    // Public names are plain names in any script — no links or digits.
    const person = { email: 'a@example.com', phone: '+91 98765 43210', attendees: 1, items: [{ typeId: 't1', quantity: 1 }], paymentMethod: 'pledge' };
    assert.equal(validateRegistration({ ...person, name: 'অনন্যা সেন' }).errors, undefined);
    assert.equal(validateRegistration({ ...person, name: "Mr. & Mrs. D'Souza-Kar" }).errors, undefined);
    assert.ok(validateRegistration({ ...person, name: 'Renew at https://evil.example' }).errors.name);
    assert.ok(validateRegistration({ ...person, name: 'Call 98765 43210' }).errors.name);
    assert.equal(validateRegistration({ ...person, name: 'Das family (walk-in) 2' }, { admin: true }).errors, undefined);
  });
});

describe('ready-made coupon templates and events', () => {
  it('every template passes the server design rules unchanged and keeps a QR code', async () => {
    const { TEMPLATES } = await import('../../client/src/components/coupons/templates.js');
    assert.ok(TEMPLATES.length >= 15);
    for (const t of TEMPLATES) {
      const { value, errors } = validateDesign(t.design);
      assert.equal(errors, undefined, `${t.id}: ${JSON.stringify(errors)}`);
      assert.equal(value.elements.length, t.design.elements.length, `${t.id} lost elements`);
      assert.equal(new Set(value.elements.map((e) => e.id)).size, value.elements.length, `${t.id} has duplicate ids`);
      // Rounded corners must stay inside the padding, or they clip the QR's corner squares.
      for (const q of value.elements.filter((e) => e.type === 'qr')) {
        assert.ok(q.radius * (1 - Math.SQRT1_2) <= q.padding, `${t.id}: QR corner radius ${q.radius} clips the code (padding ${q.padding})`);
        assert.ok(q.w >= 200, `${t.id}: QR too small to scan (${q.w}px)`);
      }
    }
  });

  it('every ready-made event and its coupon types are valid, with existing templates', async () => {
    const { EVENT_PRESETS } = await import('../../client/src/components/coupons/eventPresets.js');
    const { templateById } = await import('../../client/src/components/coupons/templates.js');
    for (const p of EVENT_PRESETS) {
      const e = validateCouponEvent({ ...p.event, startsAt: '2027-01-01T10:00:00Z', endsAt: '2027-01-01T20:00:00Z', ...(p.event.startsAt ? { startsAt: p.event.startsAt, endsAt: p.event.endsAt } : {}) });
      assert.equal(e.errors, undefined, `${p.id}: ${JSON.stringify(e.errors)}`);
      for (const t of p.types) {
        assert.ok(templateById(t.template), `${p.id}: unknown template ${t.template}`);
        const { template, ...type } = t;
        const v = validateCouponType({ ...type, design: templateById(template).design });
        assert.equal(v.errors, undefined, `${p.id}/${t.name.en}: ${JSON.stringify(v.errors)}`);
      }
    }
  });
});

describe('gate volunteer accounts', () => {
  it('validates names, usernames and PINs, and generates PINs when none is given', () => {
    const ok = validateGateUser({ name: 'Rahul Das', username: 'Rahul.Das', pin: '4821', canUndo: true, eventIds: ['e1', 'e1', ''] }, { creating: true });
    assert.equal(ok.errors, undefined);
    assert.equal(ok.value.username, 'rahul.das');
    assert.deepEqual(ok.value.eventIds, ['e1']);
    assert.equal(ok.value.canMarkPaid, false);
    assert.match(validateGateUser({ name: 'Rahul', username: 'rahul' }, { creating: true }).value.pin, /^\d{6}$/);
    const bad = validateGateUser({ name: 'R', username: 'x!', pin: '12' }, { creating: true });
    assert.ok(bad.errors.name && bad.errors.username && bad.errors.pin);
    // The website admin's username can't be reused for a volunteer.
    assert.ok(validateGateUser({ name: 'Admin', username: 'admin' }).errors.username);
    assert.equal(usernameFromName('Śubhojit Ghosh'), 'subhojit.ghosh');
    assert.match(generatePin(4), /^\d{4}$/);
  });

  it('locks an account after 5 wrong PINs in a row, and for the day after 20', () => {
    const { recordFailure, lockedUntil } = lockoutForTests;
    const t0 = Date.parse('2026-10-16T10:00:00Z');
    const min = 60_000;
    for (let i = 0; i < 4; i += 1) recordFailure('acct-1', t0 + i);
    assert.equal(lockedUntil('acct-1', t0 + 5), 0);
    recordFailure('acct-1', t0 + 5);
    assert.equal(lockedUntil('acct-1', t0 + 6), t0 + 5 + 15 * min);
    // Keep guessing in 15-minute steps: the daily cap (20) kicks in and locks until the day ends.
    let at = t0 + 16 * min;
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 5; i += 1) recordFailure('acct-1', at + i);
      at += 16 * min;
    }
    assert.equal(lockedUntil('acct-1', at), t0 + 24 * 60 * min, 'locked for the rest of the day after 20 wrong PINs');
  });
});

describe('coupon emails', () => {
  const event = { title: { en: 'Durga Puja 2026' }, startsAt: '2026-10-16T01:30:00Z', endsAt: '2026-10-21T16:30:00Z', venue: { name: 'Nirusa' } };
  const coupons = [{ status: 'active', type: { name: { en: 'Entry pass' } }, quantity: 2, code: 'ABCD-2345', url: 'http://localhost/c/x' }];

  it('never puts what a registrant typed into the email', () => {
    const registration = { name: 'Renew now at https://evil.example/pay', email: 'victim@example.com', amountDue: 0, paymentStatus: 'free' };
    const mail = buildCouponEmail({ event, registration, coupons });
    assert.equal(mail.to, 'victim@example.com');
    assert.ok(!mail.text.includes('evil.example') && !mail.html.includes('evil.example'));
    assert.match(mail.text, /^Nomoshkar,/);
    assert.match(mail.text, /If that wasn't you, you can ignore this email/);
  });

  it('limits public coupon emails per recipient and per network', () => {
    const t = Date.now();
    assert.ok([1, 2, 3].every((i) => allowPublicCouponEmail('flood@example.com', `10.0.0.${i}`, t)));
    assert.equal(allowPublicCouponEmail('FLOOD@example.com', '10.0.0.9', t), false, '4th email to the same address is refused');
    assert.equal(allowPublicCouponEmail('flood@example.com', '10.0.0.9', t + 25 * 3600 * 1000), true, 'allowed again the next day');
    const ok = Array.from({ length: 12 }, (_, i) => allowPublicCouponEmail(`p${i}@example.com`, '192.0.2.7', t));
    assert.equal(ok.filter(Boolean).length, 10, 'at most 10 emails per network per day');
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

  it('keeps the scanner for admins and gate volunteers; admins can always scan', async () => {
    // Without a database there are no volunteer accounts, so volunteer sign-in is unavailable…
    const volunteer = await request('/api/admin/scan/login', { method: 'POST', body: { username: 'rahul', pin: '1234' } });
    assert.equal(volunteer.status, 503);
    // …but a website admin can still use the scanner with their own sign-in, with every permission.
    const login = await request('/api/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
    const adminCookie = login.headers.get('set-cookie').split(';')[0];
    const me = (await (await request('/api/admin/scan/me', { cookie: adminCookie })).json()).data;
    assert.deepEqual(me, { role: 'admin', username: 'admin', name: 'Admin', canMarkPaid: true, canUndo: true, eventIds: [] });
    // Managing volunteers is admin-only.
    assert.equal((await request('/api/admin/coupons/gate-users')).status, 401);
  });

  it('keeps coupon links and the scanner out of search engines', async () => {
    const robots = await (await request('/robots.txt')).text();
    assert.match(robots, /Disallow: \/c\//);
    assert.match(robots, /Disallow: \/scan/);
  });
});
