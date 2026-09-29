/**
 * Gate volunteer accounts against a real database. Runs only when TEST_DB_HOST is set (see mysql.test.js).
 */
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const enabled = Boolean(process.env.TEST_DB_HOST);

describe('gate volunteers (MySQL)', { skip: !enabled && 'set TEST_DB_HOST to run the MySQL tests' }, () => {
  const PASSWORD = 'ma-durga-gate-test';
  const dbName = `parbon_gate_${randomBytes(4).toString('hex')}`;
  let root, tmp, server, base, adminCookie, closeDatabase, resetGateLockouts;
  let puja, bijoya, coupon;

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
      json = null;
    }
    return { status: res.status, data: json?.data, error: json?.error, text, headers: res.headers };
  };
  const admin = (p, opts = {}) => call(`/admin/coupons${p}`, { ...opts, cookie: adminCookie });
  const signIn = async (username, pin) => {
    const res = await call('/admin/scan/login', { method: 'POST', body: { username, pin } });
    return { ...res, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  };
  const scan = (cookie, p, body) => call(`/admin/scan${p}`, { method: body ? 'POST' : 'GET', body, cookie });
  const hours = (h) => new Date(Date.now() + h * 3600_000).toISOString();

  before(async () => {
    const mysql = (await import('mysql2/promise')).default;
    root = await mysql.createConnection({
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
    });
    await root.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-gate-'));
    const salt = randomBytes(16);
    const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
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
      ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`,
      SESSION_SECRET: randomBytes(48).toString('base64url'),
      SITE_URL: 'https://parbon.example',
      SMTP_HOST: '',
    });
    const { createApp } = await import('../src/app.js');
    ({ closeDatabase } = await import('../src/db/index.js'));
    ({ resetGateLockouts } = await import('../src/services/gateUserService.js'));
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
    adminCookie = login.headers.get('set-cookie').split(';')[0];

    // Two events with one registration for Durga Puja.
    puja = (await admin('/events', { method: 'POST', body: { title: { en: 'Durga Puja' }, status: 'open', startsAt: hours(24), endsAt: hours(96), totalQuota: 50 } })).data;
    bijoya = (await admin('/events', { method: 'POST', body: { title: { en: 'Bijoya' }, status: 'open', startsAt: hours(200), endsAt: hours(204), totalQuota: 50 } })).data;
    const type = (await admin(`/events/${puja.id}/types`, { method: 'POST', body: { name: { en: 'Entry pass' }, kind: 'entry', price: 100 } })).data;
    const reg = await call(`/coupons/events/${puja.slug}/register`, {
      method: 'POST',
      body: { name: 'Ananya Sen', email: 'a@example.com', phone: '+91 98765 43210', attendees: 3, items: [{ typeId: type.id, quantity: 3 }], paymentMethod: 'pledge' },
    });
    coupon = reg.data.coupons[0];
  });

  after(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await closeDatabase?.();
    await root?.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await root?.end();
    await rm(tmp, { recursive: true, force: true });
  });

  let rahul;
  it('lets the admin create a volunteer and shows the PIN only once', async () => {
    const res = await admin('/gate-users', { method: 'POST', body: { name: 'Rahul Das', username: 'rahul', pin: '4821' } });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.data.pin, '4821');
    rahul = res.data.user;
    assert.equal(rahul.canMarkPaid, false);
    assert.equal(rahul.canUndo, false);

    const generated = await admin('/gate-users', { method: 'POST', body: { name: 'Mitali', username: 'mitali', eventIds: [bijoya.id] } });
    assert.match(generated.data.pin, /^\d{6}$/);

    const dup = await admin('/gate-users', { method: 'POST', body: { name: 'Another Rahul', username: 'rahul' } });
    assert.equal(dup.status, 422);
    assert.ok(dup.error.fields.username);

    const list = await admin('/gate-users');
    assert.deepEqual(list.data.map((u) => u.username), ['mitali', 'rahul']);
    assert.ok(list.data.every((u) => !('pin' in u) && !('pinHash' in u) && !('pin_hash' in u)));
  });

  let rahulCookie;
  it('signs a volunteer in with username + PIN; the session opens only the scanner', async () => {
    assert.equal((await signIn('rahul', '0000')).status, 401);
    const ok = await signIn('RAHUL', '4821');
    assert.equal(ok.status, 200, ok.text);
    rahulCookie = ok.cookie;
    const me = await scan(rahulCookie, '/me');
    assert.deepEqual(me.data, { role: 'gate', username: 'rahul', name: 'Rahul Das', canMarkPaid: false, canUndo: false, eventIds: [] });
    assert.equal((await call('/admin/me', { cookie: rahulCookie })).status, 401);
    assert.equal((await call('/admin/coupons/events', { cookie: rahulCookie })).status, 401);
    assert.equal((await call('/admin/coupons/gate-users', { cookie: rahulCookie })).status, 401);
  });

  it('checks people in, records who did it, and enforces per-person permissions', async () => {
    const found = await scan(rahulCookie, '/lookup', { eventId: puja.id, input: coupon.code });
    assert.equal(found.data.verdict, 'ok');
    const checked = await scan(rahulCookie, '/checkin', { eventId: puja.id, couponId: found.data.coupon.id, count: 2 });
    assert.equal(checked.status, 200, checked.text);
    assert.equal(checked.data.checkins[0].by, 'rahul');

    const paid = await scan(rahulCookie, '/mark-paid', { eventId: puja.id, couponId: found.data.coupon.id });
    assert.equal(paid.status, 403);
    assert.equal(paid.error.code, 'NOT_PERMITTED');
    const undo = await scan(rahulCookie, '/undo', { eventId: puja.id, checkinId: checked.data.checkins[0].id });
    assert.equal(undo.status, 403);

    // The admin grants both permissions; they apply straight away, without signing in again.
    const updated = await admin(`/gate-users/${rahul.id}`, { method: 'PUT', body: { name: 'Rahul Das', username: 'rahul', canMarkPaid: true, canUndo: true } });
    assert.equal(updated.data.canUndo, true);
    assert.equal((await scan(rahulCookie, '/undo', { eventId: puja.id, checkinId: checked.data.checkins[0].id })).status, 200);
    assert.equal((await scan(rahulCookie, '/mark-paid', { eventId: puja.id, couponId: found.data.coupon.id })).data.registration.paymentStatus, 'paid');

    // Admins can always scan, with every permission.
    const byAdmin = await scan(adminCookie, '/checkin', { eventId: puja.id, couponId: found.data.coupon.id, count: 1 });
    assert.equal(byAdmin.data.checkins[0].by, 'admin');

    const list = (await admin('/gate-users')).data;
    assert.equal(list.find((u) => u.username === 'rahul').checkIns, 0, 'undone check-ins are not counted');
    assert.ok(list.find((u) => u.username === 'rahul').lastLoginAt);
  });

  it('limits a volunteer to the events the admin chose', async () => {
    const mitaliPin = (await admin(`/gate-users/${(await admin('/gate-users')).data.find((u) => u.username === 'mitali').id}/reset-pin`, { method: 'POST', body: { pin: '5566' } })).data.pin;
    const mitali = await signIn('mitali', mitaliPin);
    const events = await scan(mitali.cookie, '/events');
    assert.deepEqual(events.data.map((e) => e.id), [bijoya.id]);
    const denied = await scan(mitali.cookie, '/lookup', { eventId: puja.id, input: coupon.code });
    assert.equal(denied.status, 403);
    assert.equal(denied.error.code, 'EVENT_NOT_ALLOWED');
    assert.equal((await scan(mitali.cookie, `/events/${puja.id}/stats`)).status, 403);
    // Admins see every running event.
    assert.equal((await scan(adminCookie, '/events')).data.length, 2);
  });

  it('only exact usernames reach an account, so look-alike spellings can’t dodge the lockout', async () => {
    resetGateLockouts();
    const pin = (await admin(`/gate-users/${rahul.id}/reset-pin`, { method: 'POST', body: { pin: '8642' } })).data.pin;
    // The database collation treats these as "rahul", but sign-in must not.
    for (const variant of ['rähul', 'ｒａｈｕｌ', 'rahul\u200b', 'ra\u0301hul']) {
      assert.equal((await signIn(variant, pin)).status, 401, `variant ${JSON.stringify(variant)} must not sign in`);
    }
    // Wrong PINs through any spelling can't be spread across counters: 5 on the real name lock it.
    for (let i = 0; i < 5; i += 1) await signIn('rahul', '0000');
    assert.equal((await signIn('rahul', pin)).status, 429);
    assert.equal((await signIn('Rahul', pin)).status, 429, 'upper-case is the same account and shares the lock');
    const fresh = (await admin(`/gate-users/${rahul.id}/reset-pin`, { method: 'POST', body: { pin: '4821' } })).data.pin;
    const ok = await signIn('rahul', fresh);
    assert.equal(ok.status, 200);
    rahulCookie = ok.cookie;
  });

  it('locks a username after 5 wrong PINs; a PIN reset unlocks it and ends old sessions', async () => {
    resetGateLockouts();
    for (let i = 0; i < 5; i += 1) assert.equal((await signIn('rahul', '9999')).status, 401);
    const locked = await signIn('rahul', '4821');
    assert.equal(locked.status, 429);
    assert.equal(locked.error.code, 'LOCKED');
    assert.ok((await admin('/gate-users')).data.find((u) => u.username === 'rahul').locked);

    const reset = await admin(`/gate-users/${rahul.id}/reset-pin`, { method: 'POST', body: {} });
    assert.match(reset.data.pin, /^\d{6}$/);
    assert.equal((await scan(rahulCookie, '/me')).status, 401, 'the old session ends after a PIN reset');
    const again = await signIn('rahul', reset.data.pin);
    assert.equal(again.status, 200);
    rahulCookie = again.cookie;
  });

  it('turning a volunteer off signs them out at once; deleting removes them', async () => {
    const off = await admin(`/gate-users/${rahul.id}`, { method: 'PUT', body: { name: 'Rahul Das', username: 'rahul', active: false } });
    assert.equal(off.data.active, false);
    assert.equal((await scan(rahulCookie, '/me')).status, 401);
    const pinNow = (await admin(`/gate-users/${rahul.id}/reset-pin`, { method: 'POST', body: { pin: '1357' } })).data.pin;
    const disabled = await signIn('rahul', pinNow);
    assert.equal(disabled.status, 403);
    assert.equal(disabled.error.code, 'DISABLED');

    assert.equal((await admin(`/gate-users/${rahul.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await signIn('rahul', pinNow)).status, 401);
    assert.equal((await admin(`/gate-users/${rahul.id}`, { method: 'DELETE' })).status, 404);
  });
});
