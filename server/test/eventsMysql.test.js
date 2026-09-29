/**
 * Website events against a real database. Runs only when TEST_DB_HOST is set (see mysql.test.js).
 */
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const enabled = Boolean(process.env.TEST_DB_HOST);

describe('website events (MySQL)', { skip: !enabled && 'set TEST_DB_HOST to run the MySQL tests' }, () => {
  const PASSWORD = 'ma-durga-events-test';
  const dbName = `parbon_events_${randomBytes(4).toString('hex')}`;
  let root, tmp, server, base, cookie, closeDatabase, databaseReady, syncEventSeed, readSeedEvents;

  const call = async (p, { method = 'GET', body, auth = false } = {}) => {
    const res = await fetch(`${base}/api${p}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Cookie: cookie } : {}), Origin: base },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = res.status === 204 ? null : await res.json();
    return { status: res.status, data: json?.data, error: json?.error, headers: res.headers };
  };

  before(async () => {
    const mysql = (await import('mysql2/promise')).default;
    root = await mysql.createConnection({
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
    });
    await root.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-events-mysql-'));
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
    ({ closeDatabase, databaseReady } = await import('../src/db/index.js'));
    ({ syncEventSeed, readSeedEvents } = await import('../src/db/eventsTable.js'));
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
    cookie = login.headers.get('set-cookie').split(';')[0];
  });

  after(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await closeDatabase?.();
    await root?.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await root?.end();
    await rm(tmp, { recursive: true, force: true });
  });

  it('imports the seed events on start: published ones are public, the Meet & Greet waits as a draft', async () => {
    const pub = (await call('/events')).data.map((e) => e.slug);
    assert.ok(pub.includes('durga-puja-2026') && pub.includes('bijoya-sammilani-2026'));
    assert.ok(!pub.includes('meet-and-greet-2026'));
    const all = (await call('/admin/events', { auth: true })).data;
    assert.equal(all.length, 3);
    const [[{ n }]] = await root.query(`SELECT COUNT(*) AS n FROM \`${dbName}\`.site_events`);
    assert.equal(Number(n), 3);
  });

  it('publishes the draft from the admin, with its time on the public page', async () => {
    const meet = (await call('/admin/events', { auth: true })).data.find((e) => e.slug === 'meet-and-greet-2026');
    const res = await call(`/admin/events/${meet.id}`, { method: 'PUT', auth: true, body: { ...meet, state: 'published' } });
    assert.equal(res.status, 200);
    const page = (await call('/events/meet-and-greet-2026')).data;
    assert.equal(page.startTime, '17:00');
    assert.equal(page.image.src, '/media/announcements/lets-get-together.jpg');
  });

  it('never re-adds a seed event the admin deleted', async () => {
    const bijoya = (await call('/admin/events', { auth: true })).data.find((e) => e.slug === 'bijoya-sammilani-2026');
    assert.equal((await call(`/admin/events/${bijoya.id}`, { method: 'DELETE', auth: true })).status, 204);
    const db = await databaseReady();
    assert.equal(await syncEventSeed(db, await readSeedEvents()), 0, 'nothing new to seed on the next deploy');
    assert.equal((await call('/events/bijoya-sammilani-2026')).status, 404);
  });
});
