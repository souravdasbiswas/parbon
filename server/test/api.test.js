import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const storageDir = await mkdtemp(path.join(os.tmpdir(), 'parbon-test-'));
process.env.STORAGE_DIR = storageDir;
process.env.SMTP_HOST = '';
process.env.SITE_URL = 'https://parbon.example';

const { createApp } = await import('../src/app.js');
const { config } = await import('../src/config.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(storageDir, { recursive: true, force: true });
});

const post = (body) =>
  fetch(`${base}/api/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('content API', () => {
  it('reports health', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  });

  it('returns bilingual site content', async () => {
    const { data } = await (await fetch(`${base}/api/site`)).json();
    assert.equal(data.name.en, 'Parbon Sanskritik Samity');
    assert.equal(data.name.bn, 'পার্বণ সাংস্কৃতিক সমিতি');
  });

  it('lists events without heavy schedule payloads, filterable by status', async () => {
    const { data } = await (await fetch(`${base}/api/events`)).json();
    assert.ok(data.length > 1);
    assert.ok(data.every((e) => !('schedule' in e)));
    const upcoming = await (await fetch(`${base}/api/events?status=upcoming`)).json();
    assert.ok(upcoming.data.every((e) => e.status === 'upcoming'));
  });

  it('returns a single event with schedule, and 404 for unknown slugs', async () => {
    const ok = await fetch(`${base}/api/events/durga-puja-2026`);
    assert.equal(ok.status, 200);
    assert.ok((await ok.json()).data.schedule.length >= 5);
    const missing = await fetch(`${base}/api/events/nope`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'EVENT_NOT_FOUND');
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await fetch(`${base}/api/unknown`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
  });

  it('sends security headers', async () => {
    const res = await fetch(`${base}/api/health`);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp);
    assert.match(csp, /frame-src[^;]*https:\/\/script\.google\.com/);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('SEO routes', () => {
  it('serves robots.txt and sitemap.xml using SITE_URL', async () => {
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    assert.match(robots, /Sitemap: https:\/\/parbon\.example\/sitemap\.xml/);
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/events\/durga-puja-2026<\/loc>/);
  });
});

describe('client app routing', { skip: !existsSync(path.join(config.paths.clientDist, 'index.html')) && 'client not built' }, () => {
  const html = (p) => fetch(`${base}${p}`, { headers: { Accept: 'text/html' } });

  it('serves the app shell with 200 for known routes', async () => {
    for (const p of ['/', '/about', '/durga-puja', '/events/durga-puja-2026', '/contact?type=volunteer']) {
      const res = await html(p);
      assert.equal(res.status, 200, p);
      assert.match(await res.text(), /<div id="root">/);
    }
  });

  it('serves the app shell with a real 404 status for unknown routes', async () => {
    assert.equal((await html('/no-such-page')).status, 404);
    assert.equal((await html('/events/no-such-event')).status, 404);
  });

  it('writes link-preview tags (WhatsApp/Facebook) into shared announcement pages', async () => {
    const res = await html('/announcements/durga-puja-2026-invitation');
    assert.equal(res.status, 200);
    const page = await res.text();
    assert.match(page, /<title>Durga Puja 2026 — you&#39;re invited · Parbon Sanskritik Samity<\/title>/);
    assert.match(page, /og:image" content="https:\/\/parbon\.example\/media\/announcements\/durga-puja-2026-invitation\.jpg"/);
    assert.match(page, /og:description" content="Parbon Sanskritik Samity invites you all/);
    assert.equal((page.match(/og:image/g) || []).length, 1);
  });

  it('returns 404 (not 500) for missing hashed assets', async () => {
    assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  });
});

describe('inquiries API', () => {
  it('rejects invalid payloads with field errors', async () => {
    const res = await post({ name: 'A', email: 'not-an-email', message: 'short' });
    assert.equal(res.status, 422);
    const { error } = await res.json();
    assert.deepEqual(Object.keys(error.fields).sort(), ['email', 'message', 'name']);
  });

  it('rejects malformed JSON', async () => {
    const res = await fetch(`${base}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.equal(res.status, 400);
  });

  it('stores a valid enquiry (Bengali text preserved)', async () => {
    const res = await post({
      type: 'volunteer',
      name: 'অনন্যা সেন',
      email: 'Ananya@Example.com',
      message: 'আমি ভোগঘরে সাহায্য করতে চাই। I would love to help!',
    });
    assert.equal(res.status, 201);
    const { data } = await res.json();
    const stored = (await readFile(path.join(storageDir, 'inquiries.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
    const record = stored.find((r) => r.id === data.id);
    assert.equal(record.name, 'অনন্যা সেন');
    assert.equal(record.email, 'ananya@example.com');
  });

  it('silently accepts but discards honeypot submissions', async () => {
    const res = await post({ name: 'Bot', email: 'bot@spam.io', message: 'Buy now buy now', website: 'http://spam' });
    assert.equal(res.status, 201);
    const stored = await readFile(path.join(storageDir, 'inquiries.ndjson'), 'utf8');
    assert.ok(!stored.includes('bot@spam.io'));
  });

  it('rate limits repeated submissions', async () => {
    let last;
    for (let i = 0; i < 6; i += 1) last = await post({ name: 'Rate', email: 'r@x.io', message: 'x' });
    assert.equal(last.status, 429);
  });
});
