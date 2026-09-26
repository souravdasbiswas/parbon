import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// Isolated storage/media for this test process, configured before the app is imported.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-admin-'));
const PASSWORD = 'durga-maa-ki-joi-2026';
const salt = randomBytes(16);
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  MEDIA_DIR: path.join(tmp, 'media'),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
});

const { createApp } = await import('../src/app.js');

let server;
let base;
let cookie = '';

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const api = (p, { method = 'GET', body, headers = {}, auth = true } = {}) =>
  fetch(`${base}/api${p}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
      Origin: base,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const sample = {
  title: { en: 'Bhog volunteers needed', bn: 'ভোগঘরে স্বেচ্ছাসেবক চাই' },
  body: { en: 'Join us in the kitchen on Ashtami 🙏\n\nSee you there!' },
  contact: { name: 'Ananya', phone: '+91 98765 43210' },
  location: { name: 'Community hall', mapUrl: 'https://maps.app.goo.gl/example' },
};

describe('public announcements', () => {
  it('seeds the store and lists the Durga Puja invitation', async () => {
    const { data } = await (await api('/announcements', { auth: false })).json();
    assert.ok(data.length >= 1);
    assert.equal(data[0].slug, 'durga-puja-2026-invitation');
    assert.match(data[0].body.en, /Durga Maa ki Joi 🙏/);
    assert.ok(existsSync(path.join(tmp, 'storage', 'announcements.json')));
  });

  it('returns 404 for unknown announcements', async () => {
    assert.equal((await api('/announcements/nope', { auth: false })).status, 404);
  });
});

describe('admin authentication', () => {
  it('rejects protected routes without a session', async () => {
    assert.equal((await api('/admin/me', { auth: false })).status, 401);
    assert.equal((await api('/admin/announcements', { method: 'POST', body: sample, auth: false })).status, 401);
  });

  it('rejects wrong credentials', async () => {
    const res = await api('/admin/login', { method: 'POST', body: { username: 'admin', password: 'wrong-password' }, auth: false });
    assert.equal(res.status, 401);
  });

  it('signs in with a secure HttpOnly SameSite=Strict cookie', async () => {
    const res = await api('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD }, auth: false });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    cookie = setCookie.split(';')[0];
    assert.equal((await (await api('/admin/me')).json()).data.username, 'admin');
  });

  it('rejects tampered session cookies', async () => {
    const res = await api('/admin/me', { headers: { Cookie: `${cookie.slice(0, -2)}xx` }, auth: false });
    assert.equal(res.status, 401);
  });

  it('blocks cross-site (CSRF) writes', async () => {
    const res = await api('/admin/announcements', { method: 'POST', body: sample, headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });
});

describe('admin announcement management', () => {
  let created;

  it('validates input', async () => {
    const res = await api('/admin/announcements', {
      method: 'POST',
      body: { title: { en: 'x' }, body: {}, link: { label: 'Bad', url: 'javascript:alert(1)' } },
    });
    assert.equal(res.status, 422);
    const { error } = await res.json();
    assert.ok(error.fields['title.en'] && error.fields['body.en'] && error.fields['link.url']);
  });

  it('creates, publishes and lists an announcement', async () => {
    const res = await api('/admin/announcements', { method: 'POST', body: sample });
    assert.equal(res.status, 201);
    created = (await res.json()).data;
    assert.equal(created.slug, 'bhog-volunteers-needed');
    const list = (await (await api('/announcements', { auth: false })).json()).data;
    assert.ok(list.some((a) => a.id === created.id));
  });

  it('keeps drafts out of the public list', async () => {
    await api(`/admin/announcements/${created.id}`, { method: 'PUT', body: { ...sample, status: 'draft' } });
    const list = (await (await api('/announcements', { auth: false })).json()).data;
    assert.ok(!list.some((a) => a.id === created.id));
    const all = (await (await api('/admin/announcements')).json()).data;
    assert.ok(all.some((a) => a.id === created.id && a.status === 'draft'));
  });

  it('deletes an announcement', async () => {
    assert.equal((await api(`/admin/announcements/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api(`/admin/announcements/${created.id}`)).status, 404);
  });
});

describe('admin image uploads', () => {
  const png1x1 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('accepts a real image and serves it from /media', async () => {
    const res = await api('/admin/uploads', { method: 'POST', body: { dataUrl: png1x1 } });
    assert.equal(res.status, 201);
    const { src } = (await res.json()).data;
    assert.match(src, /^\/media\/announcements\/\d{8}-[a-f0-9]{12}\.png$/);
    assert.equal((await fetch(`${base}${src}`)).status, 200);
  });

  it('rejects files that are not images, whatever they claim to be', async () => {
    const fake = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
    assert.equal((await api('/admin/uploads', { method: 'POST', body: { dataUrl: fake } })).status, 422);
  });

  it('signs out', async () => {
    const res = await api('/admin/logout', { method: 'POST' });
    assert.match(res.headers.get('set-cookie'), /parbon_admin=;/);
  });
});
