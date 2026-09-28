/**
 * MySQL store tests. They need a disposable MySQL/MariaDB server and run only when TEST_DB_HOST is set:
 *   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD= npm test
 * A fresh database is created for each run and dropped afterwards.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';

const enabled = Boolean(process.env.TEST_DB_HOST);

describe('MySQL storage', { skip: !enabled && 'set TEST_DB_HOST to run the MySQL tests' }, () => {
  const PASSWORD = 'ma-durga-mysql-test';
  const dbName = `parbon_test_${randomBytes(4).toString('hex')}`;
  const seed = [];
  let tmp, storage, legacyRoot, olderRoot, base, server, cookie, admin, closeDatabase, databaseReady, root, hashes;

  const sha = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
  const api = (p, { method = 'GET', body, auth = true } = {}) =>
    fetch(`${base}/api${p}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && cookie ? { Cookie: cookie } : {}),
        Origin: base,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const json = async (p, opts) => (await (await api(p, opts)).json()).data;

  before(async () => {
    const mysql = (await import('mysql2/promise')).default;
    root = await mysql.createConnection({
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
    });
    await root.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    seed.push(...JSON.parse(await readFile(new URL('../data/announcements.seed.json', import.meta.url), 'utf8')).announcements);
    const [newest, original] = seed;

    tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-mysql-'));
    // Current deployment's storage: the old file store with one admin post, and the newest seed
    // entry deleted by an admin (in `seeded` but not in `announcements`) — it must stay deleted.
    storage = path.join(tmp, 'storage');
    await mkdir(storage, { recursive: true });
    const adminPost = { ...original, id: 'admin-post', slug: 'admin-post', title: { en: 'Admin post' }, pinned: false };
    await writeFile(
      path.join(storage, 'announcements.json'),
      JSON.stringify({ announcements: [original, adminPost], seeded: [original.id, newest.id] }),
    );
    await writeFile(
      path.join(storage, 'inquiries.ndjson'),
      [
        { id: 'inq-1', createdAt: '2026-09-27T10:00:00.000Z', type: 'volunteer', name: 'Ananya Sen', email: 'a@example.com', message: 'আমি সাহায্য করতে চাই — bhog!', meta: { ip: '203.0.113.1', userAgent: 'UA 1' } },
        { id: 'inq-2', createdAt: '2026-09-27T11:00:00.000Z', type: 'membership', name: 'Rahul Das', email: 'r@example.com', message: 'Please add us as members.', meta: {} },
      ]
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n{"broken"\n',
    );

    // A previous deployment folder (as on Hostinger: hbuilds/versions/<id>/nodejs) with one duplicate and one new response, and an uploaded image.
    legacyRoot = path.join(tmp, 'old-version', 'nodejs');
    await mkdir(path.join(legacyRoot, 'server', 'storage'), { recursive: true });
    await mkdir(path.join(legacyRoot, 'server', 'media', 'announcements'), { recursive: true });
    await writeFile(
      path.join(legacyRoot, 'server', 'storage', 'inquiries.ndjson'),
      [
        { id: 'inq-1', createdAt: '2026-09-27T10:00:00.000Z', type: 'volunteer', name: 'Ananya Sen', email: 'a@example.com', message: 'duplicate', meta: {} },
        { id: 'inq-0', createdAt: '2026-09-20T09:00:00.000Z', type: 'general', name: 'Early Bird', email: 'e@example.com', message: 'Registered on day one.', meta: {} },
      ]
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n',
    );
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    await writeFile(path.join(legacyRoot, 'server', 'media', 'announcements', '20260927-oldupload.jpg'), jpeg);
    // An even older deployment: its snapshot has an announcement that exists nowhere else (must be
    // kept) and an outdated copy of "admin-post" (the newer copy must win).
    olderRoot = path.join(tmp, 'older-version', 'nodejs');
    await mkdir(path.join(olderRoot, 'server', 'storage'), { recursive: true });
    const olderFile = path.join(olderRoot, 'server', 'storage', 'announcements.json');
    await writeFile(
      olderFile,
      JSON.stringify({
        announcements: [
          { ...adminPost, title: { en: 'Outdated title' } },
          { ...original, id: 'older-era-post', slug: 'older-era-post', title: { en: 'Only in the older deployment' }, pinned: false },
        ],
      }),
    );
    const old = new Date(Date.now() - 7 * 86_400_000);
    await utimes(olderFile, old, old);

    hashes = {
      store: await sha(path.join(storage, 'announcements.json')),
      inquiries: await sha(path.join(storage, 'inquiries.ndjson')),
      legacy: await sha(path.join(legacyRoot, 'server', 'storage', 'inquiries.ndjson')),
    };

    const salt = randomBytes(16);
    const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
    Object.assign(process.env, {
      STORAGE_DIR: storage,
      MEDIA_DIR: path.join(tmp, 'media'),
      LEGACY_IMPORT_DIRS: `${legacyRoot},${olderRoot}`,
      DB_HOST: process.env.TEST_DB_HOST,
      DB_PORT: process.env.TEST_DB_PORT || '3306',
      DB_USER: process.env.TEST_DB_USER || 'root',
      DB_PASSWORD: process.env.TEST_DB_PASSWORD || '',
      DB_NAME: dbName,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`,
      SESSION_SECRET: randomBytes(48).toString('base64url'),
      SITE_URL: 'http://localhost',
      SMTP_HOST: '',
    });

    const { createApp } = await import('../src/app.js');
    ({ closeDatabase, databaseReady } = await import('../src/db/index.js'));
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await api('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD }, auth: false });
    cookie = login.headers.get('set-cookie').split(';')[0];
    admin = (p, opts) => json(`/admin${p}`, opts);
  });

  after(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await closeDatabase?.();
    await root?.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await root?.end();
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  it('reports MySQL storage in the health check', async () => {
    const health = await (await api('/health', { auth: false })).json();
    assert.equal(health.storage, 'mysql');
  });

  it('imports the old announcements and keeps an admin-deleted seed entry deleted', async () => {
    const [newest, original] = seed;
    const all = await admin('/announcements');
    const ids = all.map((a) => a.id);
    assert.ok(ids.includes(original.id));
    assert.ok(ids.includes('admin-post'));
    assert.ok(!ids.includes(newest.id), 'deleted seed entry must not come back');
  });

  it('merges every old deployment: nothing only found in an older one is lost, the newest copy wins', async () => {
    const all = await admin('/announcements');
    assert.ok(all.some((a) => a.id === 'older-era-post'));
    assert.equal(all.find((a) => a.id === 'admin-post').title.en, 'Admin post');
  });

  it('imports form responses from all old files once, without duplicates', async () => {
    const data = await admin('/responses');
    assert.deepEqual(
      data.items.map((r) => r.id),
      ['inq-2', 'inq-1', 'inq-0'],
    );
    const ananya = data.items.find((r) => r.id === 'inq-1');
    assert.equal(ananya.message, 'আমি সাহায্য করতে চাই — bhog!');
    assert.equal(ananya.ip, '203.0.113.1');
    assert.equal(ananya.typeLabel, 'Volunteering');
  });

  it('never changes the old files', async () => {
    assert.equal(await sha(path.join(storage, 'announcements.json')), hashes.store);
    assert.equal(await sha(path.join(storage, 'inquiries.ndjson')), hashes.inquiries);
    assert.equal(await sha(path.join(legacyRoot, 'server', 'storage', 'inquiries.ndjson')), hashes.legacy);
  });

  it('saves new submissions in the database, not the file', async () => {
    const res = await api('/inquiries', {
      method: 'POST',
      auth: false,
      body: { type: 'sponsorship', name: 'New Sponsor', email: 'sponsor@example.com', phone: '+91 90000 11111', message: 'We would like to sponsor the evening.' },
    });
    assert.equal(res.status, 201);
    const data = await admin('/responses');
    assert.equal(data.items[0].name, 'New Sponsor');
    assert.equal(data.total, 4);
    assert.equal(await sha(path.join(storage, 'inquiries.ndjson')), hashes.inquiries);
    const csv = await (await api('/admin/responses/export.csv')).text();
    assert.match(csv, /New Sponsor/);
  });

  it('creates, updates, lists and deletes announcements', async () => {
    const created = await admin('/announcements', { method: 'POST', body: { title: { en: 'Admin post' }, body: { en: 'Same title as an imported post.' } } });
    assert.equal(created.slug, 'admin-post-2');
    const updated = await admin(`/announcements/${created.id}`, {
      method: 'PUT',
      body: { title: { en: 'Admin post' }, body: { en: 'Edited ✨' }, pinned: true, icon: 'music' },
    });
    assert.equal(updated.body.en, 'Edited ✨');
    assert.equal(updated.createdAt, created.createdAt);
    const ticker = await json('/announcements?ticker=1', { auth: false });
    assert.equal(ticker[0].id, created.id);
    assert.equal((await api(`/announcements/${created.slug}`, { auth: false })).status, 200);
    assert.equal((await api(`/admin/announcements/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api(`/admin/announcements/${created.id}`)).status, 404);
  });

  it('stores uploaded images in the database and serves them, including imported ones', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const { src } = await admin('/uploads', { method: 'POST', body: { dataUrl: png } });
    assert.ok(!existsSync(path.join(tmp, 'media', 'announcements', path.basename(src))), 'not written to disk');
    const img = await fetch(`${base}${src}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    const old = await fetch(`${base}/media/announcements/20260927-oldupload.jpg`);
    assert.equal(old.status, 200);
    assert.equal(old.headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${base}/media/announcements/missing.jpg`)).status, 404);
  });

  it('does not import or duplicate anything again after a restart', async () => {
    const before = (await admin('/responses')).total;
    const announcementsBefore = (await admin('/announcements')).length;
    await closeDatabase();
    await databaseReady();
    assert.equal((await admin('/responses')).total, before);
    assert.equal((await admin('/announcements')).length, announcementsBefore);
  });

  it('shows the storage status to admins only', async () => {
    assert.equal((await api('/admin/storage', { auth: false })).status, 401);
    const report = await admin('/storage');
    assert.equal(report.status, 'connected');
    assert.equal(report.counts.inquiries, (await admin('/responses')).total);
    assert.ok(report.imports.some((i) => i.kind === 'inquiries'));
  });

  it('db:migrate script: dry run changes nothing, a real run imports downloaded files', async () => {
    const { execFile } = await import('node:child_process');
    const run = (args) =>
      new Promise((resolve, reject) =>
        execFile(process.execPath, [fileURLToPath(new URL('../../scripts/db-migrate.mjs', import.meta.url)), ...args], {
          env: process.env,
        }, (error, stdout, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve(stdout))),
      );
    const download = path.join(tmp, 'downloaded-backup');
    await mkdir(download, { recursive: true });
    await writeFile(
      path.join(download, 'inquiries.ndjson'),
      `${JSON.stringify({ id: 'inq-downloaded', createdAt: '2026-09-25T08:00:00.000Z', type: 'performance', name: 'From Backup', email: 'b@example.com', message: 'Saved from a downloaded file.', meta: {} })}\n`,
    );
    const before = (await admin('/responses')).total;
    const dry = await run(['--dry-run', '--from', download]);
    assert.match(dry, /1\s+.*inquiries\.ndjson/);
    assert.equal((await admin('/responses')).total, before);

    const out = await run(['--from', download]);
    assert.match(out, /Imported 0 announcements, 1 form responses, 0 images/);
    assert.equal((await admin('/responses')).total, before + 1);
    assert.match(await run(['--from', download]), /Imported 0 announcements, 0 form responses/);
  });
});
