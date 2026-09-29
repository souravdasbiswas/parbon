/**
 * Coupon flow against a real database. Runs only when TEST_DB_HOST is set (see mysql.test.js):
 *   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD= npm test
 */
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const enabled = Boolean(process.env.TEST_DB_HOST);

describe('coupons (MySQL)', { skip: !enabled && 'set TEST_DB_HOST to run the MySQL tests' }, () => {
  const PASSWORD = 'ma-durga-coupon-test';
  const PIN = '246810';
  const dbName = `parbon_coupons_${randomBytes(4).toString('hex')}`;
  let root, tmp, server, base, adminCookie, scannerCookie, closeDatabase;
  let event, entry, food, other;

  const hash = (secret) => {
    const salt = randomBytes(16);
    const h = scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`;
  };
  const call = async (p, { method = 'GET', body, cookie } = {}) => {
    const res = await fetch(`${base}/api${p}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: base },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, data: json?.data, error: json?.error, text, headers: res.headers };
  };
  const admin = (p, opts = {}) => call(`/admin/coupons${p}`, { ...opts, cookie: adminCookie });
  const scan = (p, body) => call(`/admin/scan${p}`, { method: body ? 'POST' : 'GET', body, cookie: scannerCookie });
  const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();
  const registration = (overrides = {}) => ({
    name: 'Ananya Sen',
    email: 'ananya@example.com',
    phone: '+91 98765 43210',
    attendees: 4,
    items: [{ typeId: entry.id, quantity: 4 }],
    paymentMethod: 'txn',
    txnRef: 'UPI-12345678',
    ...overrides,
  });

  before(async () => {
    const mysql = (await import('mysql2/promise')).default;
    root = await mysql.createConnection({
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
    });
    await root.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-coupons-mysql-'));
    Object.assign(process.env, {
      STORAGE_DIR: path.join(tmp, 'storage'),
      MEDIA_DIR: path.join(tmp, 'media'),
      LEGACY_IMPORT_DIRS: '',
      DB_HOST: process.env.TEST_DB_HOST,
      DB_PORT: process.env.TEST_DB_PORT || '3306',
      DB_USER: process.env.TEST_DB_USER || 'root',
      DB_PASSWORD: process.env.TEST_DB_PASSWORD || '',
      DB_NAME: dbName,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: hash(PASSWORD),
      SCANNER_PIN_HASH: hash(PIN),
      SESSION_SECRET: randomBytes(48).toString('base64url'),
      SITE_URL: 'https://parbon.example',
      SMTP_HOST: '',
    });
    const { createApp } = await import('../src/app.js');
    ({ closeDatabase } = await import('../src/db/index.js'));
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
    adminCookie = login.headers.get('set-cookie').split(';')[0];
    const pin = await call('/admin/scan/login', { method: 'POST', body: { pin: PIN } });
    scannerCookie = pin.headers.get('set-cookie').split(';')[0];
  });

  after(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await closeDatabase?.();
    await root?.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await root?.end();
    await rm(tmp, { recursive: true, force: true });
  });

  it('lets an admin create an event and its coupon types', async () => {
    const created = await admin('/events', {
      method: 'POST',
      body: {
        title: { en: 'Durga Puja 2026', bn: 'দুর্গোৎসব ২০২৬' },
        status: 'open',
        startsAt: inHours(24),
        endsAt: inHours(24 * 5),
        totalQuota: 10,
        maxAttendees: 8,
        linkedEventSlug: 'durga-puja-2026',
        payment: { upiId: '8577855186@slc', payeeName: 'Parbon Sanskritik Samity' },
      },
    });
    assert.equal(created.status, 201, created.text);
    event = created.data;
    assert.equal(event.slug, 'durga-puja-2026');

    const dup = await admin('/events', { method: 'POST', body: { title: { en: 'Durga Puja 2026' }, startsAt: inHours(1), endsAt: inHours(2), totalQuota: 5 } });
    assert.equal(dup.status, 422);
    assert.ok(dup.error.fields.slug);

    entry = (await admin(`/events/${event.id}/types`, { method: 'POST', body: { name: { en: 'Entry pass' }, kind: 'entry', price: 100, maxPerRegistration: 6 } })).data;
    food = (await admin(`/events/${event.id}/types`, { method: 'POST', body: { name: { en: 'Bhog coupon' }, kind: 'food', price: 50, quota: 3, sortOrder: 1 } })).data;
    other = (await admin(`/events/${event.id}/types`, { method: 'POST', body: { name: { en: 'Free kids pass' }, kind: 'other', price: 0, sortOrder: 2 } })).data;
    assert.ok(entry.id && food.id && other.id);

    const design = await admin(`/types/${entry.id}/design`, {
      method: 'PUT',
      body: { width: 1200, height: 560, elements: [{ id: 'qr', type: 'qr', x: 900, y: 80, w: 240, h: 240 }, { id: 't', type: 'text', text: '{{name}}' }] },
    });
    assert.equal(design.status, 200, design.text);
    assert.equal(design.data.design.elements.length, 2);
    // Editing the type keeps its design.
    const edited = await admin(`/types/${entry.id}`, { method: 'PUT', body: { name: { en: 'Entry pass' }, kind: 'entry', price: 100, maxPerRegistration: 6 } });
    assert.equal(edited.data.design.elements.length, 2);
  });

  it('shows open events publicly, including from the linked site event', async () => {
    const list = await call('/coupons/events?linked=durga-puja-2026');
    assert.equal(list.data.length, 1);
    const pub = await call(`/coupons/events/${event.slug}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.data.registration, 'open');
    assert.equal(pub.data.remaining, 10);
    assert.deepEqual(pub.data.types.map((t) => t.remaining), [10, 3, 10]);
    assert.equal(pub.data.types[0].design, undefined, 'designs are not needed on the public form');
  });

  let first;
  it('issues one coupon per type with a quantity, and a working link', async () => {
    const res = await call(`/coupons/events/${event.slug}/register`, {
      method: 'POST',
      body: registration({ items: [{ typeId: entry.id, quantity: 4 }, { typeId: food.id, quantity: 2 }] }),
    });
    assert.equal(res.status, 201, res.text);
    first = res.data;
    assert.equal(first.registration.amountDue, 500);
    assert.equal(first.registration.paymentStatus, 'to_verify');
    assert.equal(first.coupons.length, 2);
    assert.match(first.coupons[0].code, /^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    assert.match(first.coupons[0].url, /^https:\/\/parbon\.example\/c\/[\w-]{22}$/);

    const coupon = await call(`/coupons/c/${first.coupons[0].token}`);
    assert.equal(coupon.status, 200);
    assert.equal(coupon.data.holder, 'Ananya Sen');
    assert.equal(coupon.data.quantity, 4);
    assert.equal(coupon.data.type.kind, 'entry');
    assert.equal(coupon.data.type.design.elements.length, 2);
    assert.equal(coupon.data.email, undefined, 'no contact details on the public coupon');
  });

  it('enforces per-type, per-registration and total limits', async () => {
    const tooManyFood = await call(`/coupons/events/${event.slug}/register`, { method: 'POST', body: registration({ items: [{ typeId: food.id, quantity: 2 }] }) });
    assert.equal(tooManyFood.status, 422);
    assert.match(tooManyFood.error.fields[`items.${food.id}`], /Only 1 left/);

    const overPerReg = await call(`/coupons/events/${event.slug}/register`, { method: 'POST', body: registration({ items: [{ typeId: entry.id, quantity: 7 }] }) });
    assert.equal(overPerReg.status, 422);

    const tooManyPeople = await call(`/coupons/events/${event.slug}/register`, { method: 'POST', body: registration({ attendees: 9 }) });
    assert.equal(tooManyPeople.status, 422);
    assert.ok(tooManyPeople.error.fields.attendees);
  });

  it('never oversells when many people register at once', async () => {
    // 4 of the 10 are left (6 issued); 6 parallel requests for 1 pledge each must yield exactly 4.
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        call(`/coupons/events/${event.slug}/register`, {
          method: 'POST',
          body: registration({ name: `Guest ${i}`, attendees: 1, items: [{ typeId: other.id, quantity: 1 }], paymentMethod: 'pledge', txnRef: '' }),
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 4);
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.error.code === 'SOLD_OUT'));
    assert.equal(results.find((r) => r.status === 201).data.registration.paymentStatus, 'free');
    const detail = await admin(`/events/${event.id}`);
    assert.equal(detail.data.stats.issued, 10);
    assert.equal(detail.data.stats.remaining, 0);
  });

  it('checks people in at the gate, in parts, and refuses extra entries', async () => {
    const events = await scan('/events');
    assert.ok(events.data.some((e) => e.id === event.id));

    const byLink = await scan('/lookup', { eventId: event.id, input: first.coupons[0].url });
    assert.equal(byLink.data.verdict, 'ok');
    assert.equal(byLink.data.registration.paymentStatus, 'to_verify');

    const byCode = await scan('/lookup', { eventId: event.id, input: first.coupons[0].code.toLowerCase().replace('-', ' ') });
    assert.equal(byCode.data.coupon.id, byLink.data.coupon.id);

    const two = await scan('/checkin', { eventId: event.id, couponId: byLink.data.coupon.id, count: 2 });
    assert.equal(two.data.coupon.usedCount, 2);
    assert.match(two.data.message, /2 of 4 already in/);

    const tooMany = await scan('/checkin', { eventId: event.id, couponId: byLink.data.coupon.id, count: 3 });
    assert.equal(tooMany.status, 409);
    assert.equal(tooMany.error.code, 'TOO_MANY');

    const rest = await scan('/checkin', { eventId: event.id, couponId: byLink.data.coupon.id, count: 2 });
    assert.equal(rest.data.verdict, 'used');

    const again = await scan('/checkin', { eventId: event.id, couponId: byLink.data.coupon.id, count: 1 });
    assert.equal(again.error.code, 'FULLY_USED');

    const undone = await scan('/undo', { eventId: event.id, checkinId: rest.data.checkins[0].id });
    assert.equal(undone.data.coupon.usedCount, 2);
    assert.equal(undone.data.verdict, 'ok');

    const paid = await scan('/mark-paid', { eventId: event.id, couponId: byLink.data.coupon.id });
    assert.equal(paid.data.registration.paymentStatus, 'paid');

    const regs = await admin(`/events/${event.id}/registrations`);
    const reg = regs.data.find((r) => r.id === first.registration.id);
    assert.equal(reg.attendance, 'partial');
    assert.match(reg.adminNote, /scanner: payment paid — collected at the gate/);
  });

  it('cancels and reissues coupons; old links stop working at once', async () => {
    const regs = (await admin(`/events/${event.id}/registrations`)).data;
    const reg = regs.find((r) => r.id === first.registration.id);
    const entryCoupon = reg.coupons.find((c) => c.typeId === entry.id);

    const reissued = await admin(`/coupons/${entryCoupon.id}/reissue`, { method: 'POST' });
    assert.equal(reissued.status, 200, reissued.text);
    assert.notEqual(reissued.data.code, entryCoupon.code);
    assert.equal(reissued.data.usedCount, 2, 'check-ins carry over');

    const oldLink = await call(`/coupons/c/${entryCoupon.token}`);
    assert.equal(oldLink.data.status, 'replaced');
    assert.equal(oldLink.data.code, null);
    const oldScan = await scan('/lookup', { eventId: event.id, input: entryCoupon.code });
    assert.equal(oldScan.data.verdict, 'replaced');

    const cancelled = await admin(`/coupons/${reissued.data.id}/cancel`, { method: 'POST', body: { reason: 'Refunded' } });
    assert.equal(cancelled.data.status, 'cancelled');
    const cancelledScan = await scan('/lookup', { eventId: event.id, input: reissued.data.url });
    assert.equal(cancelledScan.data.verdict, 'cancelled');
    assert.match(cancelledScan.data.message, /Refunded/);
    const blocked = await scan('/checkin', { eventId: event.id, couponId: reissued.data.id, count: 1 });
    assert.equal(blocked.error.code, 'NOT_ACTIVE');

    // Cancelling freed 4 places, so the coupon can be brought back.
    const back = await admin(`/coupons/${reissued.data.id}/reissue`, { method: 'POST' });
    assert.equal(back.status, 200, back.text);
    assert.equal(back.data.status, 'active');

    const detail = await admin(`/events/${event.id}`);
    assert.equal(detail.data.stats.issued, 10);
    assert.equal(detail.data.stats.checkedIn, 2, 'replaced coupons are not counted twice');
  });

  it('lets admins record walk-ins and payments, and exports a CSV', async () => {
    await admin(`/events/${event.id}`, { method: 'PUT', body: { ...event, totalQuota: 12 } });
    const walkIn = await admin(`/events/${event.id}/registrations`, {
      method: 'POST',
      body: { name: 'Walk-in family', attendees: 2, items: [{ typeId: entry.id, quantity: 2 }], paymentMethod: 'pledge', markPaid: true },
    });
    assert.equal(walkIn.status, 201, walkIn.text);
    assert.equal(walkIn.data.registration.paymentStatus, 'paid');

    const payment = await admin(`/registrations/${first.registration.id}/payment`, { method: 'PUT', body: { status: 'rejected', note: 'No such UPI ref' } });
    assert.equal(payment.data.paymentStatus, 'rejected');

    const lower = await admin(`/events/${event.id}`, { method: 'PUT', body: { ...event, totalQuota: 5 } });
    assert.equal(lower.status, 422);

    const csv = await fetch(`${base}/api/admin/coupons/events/${event.id}/export.csv`, { headers: { Cookie: adminCookie } });
    const text = await csv.text();
    assert.match(csv.headers.get('content-disposition'), /durga-puja-2026-attendees/);
    assert.match(text, /Walk-in family/);
    assert.match(text, /Entry pass ×4 \[/);

    assert.equal((await admin(`/types/${entry.id}`, { method: 'DELETE' })).status, 409);
    assert.equal((await admin(`/events/${event.id}`, { method: 'DELETE' })).status, 409);
  });

  it('turns coupon links off after the event, and blocks late scans', async () => {
    const other2 = (
      await admin('/events', {
        method: 'POST',
        body: { title: { en: 'Bijoya Sammilani' }, status: 'open', startsAt: inHours(1), endsAt: inHours(3), totalQuota: 20 },
      })
    ).data;
    const wrong = await scan('/lookup', { eventId: other2.id, input: first.coupons[1].url });
    assert.equal(wrong.data.verdict, 'wrong_event');

    await admin(`/events/${event.id}`, {
      method: 'PUT',
      body: { ...event, totalQuota: 12, startsAt: inHours(-48), endsAt: inHours(-2), linksExpireAt: inHours(-1) },
    });
    const expired = await call(`/coupons/c/${first.coupons[1].token}`);
    assert.equal(expired.status, 410);
    assert.equal(expired.error.code, 'COUPON_EXPIRED');
    const late = await scan('/checkin', { eventId: event.id, couponId: (await admin(`/events/${event.id}/registrations`)).data[0].coupons[0].id, count: 1 });
    assert.equal(late.status, 409);
    const closed = await call(`/coupons/events/${event.slug}/register`, { method: 'POST', body: registration() });
    assert.equal(closed.status, 409);
    assert.equal(closed.error.code, 'REGISTRATION_CLOSED');
    assert.ok(!(await scan('/events')).data.some((e) => e.id === event.id));
  });
});
