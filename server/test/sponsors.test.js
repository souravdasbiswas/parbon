import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// Isolated storage for this test process, configured before the app is imported.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-sponsors-'));
const PASSWORD = 'pujo-sponsor-test-2026';
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
const seed = JSON.parse(await readFile(new URL('../data/sponsors.seed.json', import.meta.url), 'utf8')).sponsors;

let server;
let base;
let cookie = '';

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await api('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD }, auth: false });
  cookie = res.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

function api(p, { method = 'GET', body, auth = true } = {}) {
  return fetch(`${base}/api${p}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
      Origin: base,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const data = async (p, opts) => (await (await api(p, opts)).json()).data;
const publicNames = async () => (await data('/sponsors', { auth: false })).map((s) => s.name);

const sample = {
  name: 'Maa Tara Sweets',
  url: 'https://example.com/',
  logo: { src: '/media/announcements/20261012-abcdef123456.jpg', width: 300, height: 200 },
};

describe('sponsors', () => {
  it('lists the shipped sponsors in order, with only public fields', async () => {
    const list = await data('/sponsors', { auth: false });
    assert.deepEqual(
      list.map((s) => s.id),
      seed.map((s) => s.id),
    );
    assert.deepEqual(Object.keys(list[0]).sort(), ['id', 'logo', 'name', 'tile', 'url']);
    assert.equal(list[2].tile, true);
  });

  it('requires an admin session to manage sponsors', async () => {
    assert.equal((await api('/admin/sponsors', { auth: false })).status, 401);
    assert.equal((await api('/admin/sponsors', { method: 'POST', body: sample, auth: false })).status, 401);
  });

  it('rejects a sponsor without a name, a https website or an uploaded logo', async () => {
    const res = await api('/admin/sponsors', {
      method: 'POST',
      body: { name: '', url: 'javascript:alert(1)', logo: { src: 'https://evil.example/logo.png' } },
    });
    assert.equal(res.status, 422);
    const { error } = await res.json();
    assert.deepEqual(Object.keys(error.fields).sort(), ['logo.src', 'name', 'url']);
  });

  let created;
  it('adds a sponsor at the end of the list', async () => {
    const res = await api('/admin/sponsors', { method: 'POST', body: sample });
    assert.equal(res.status, 201);
    created = (await res.json()).data;
    assert.equal(created.sortOrder, seed.length + 1);
    assert.equal(created.status, 'published');
    assert.equal((await publicNames()).at(-1), 'Maa Tara Sweets');
  });

  it('edits a sponsor and hides it from the site without deleting it', async () => {
    const res = await api(`/admin/sponsors/${created.id}`, { method: 'PUT', body: { ...sample, name: 'Maa Tara Mishti', status: 'hidden' } });
    assert.equal(res.status, 200);
    assert.ok(!(await publicNames()).includes('Maa Tara Mishti'));
    const all = await data('/admin/sponsors');
    assert.equal(all.find((s) => s.id === created.id).name, 'Maa Tara Mishti');
  });

  it('reorders sponsors', async () => {
    const ids = (await data('/admin/sponsors')).map((s) => s.id);
    const res = await api('/admin/sponsors/order', { method: 'PUT', body: { ids: [ids[2], ids[0]] } });
    assert.equal(res.status, 200);
    assert.deepEqual(
      (await data('/admin/sponsors')).map((s) => s.id),
      [ids[2], ids[0], ids[1], ids[3]],
    );
    assert.equal((await api('/admin/sponsors/order', { method: 'PUT', body: { ids: ['a', 'a'] } })).status, 422);
  });

  it('deletes a shipped sponsor for good', async () => {
    const id = seed[0].id;
    assert.equal((await api(`/admin/sponsors/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api(`/admin/sponsors/${id}`, { method: 'DELETE' })).status, 404);
    const stored = JSON.parse(await readFile(path.join(tmp, 'storage', 'sponsors.json'), 'utf8'));
    assert.ok(stored.seeded.includes(id), 'remembered as seeded, so it is not added back');
    assert.ok(!stored.sponsors.some((s) => s.id === id));
  });
});
