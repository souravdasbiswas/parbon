import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const storageDir = await mkdtemp(path.join(os.tmpdir(), 'parbon-v2-routes-'));
Object.assign(process.env, {
  STORAGE_DIR: storageDir,
  SMTP_HOST: '',
  SITE_URL: 'https://parbon.example',
  UI_VERSION: 'v2',
  UI_PREVIEW: 'true',
});

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

const htmlBuilt = existsSync(path.join(config.paths.clientDist, 'index.html'));
const html = (url, extra = {}) => fetch(`${base}${url}`, { headers: { Accept: 'text/html', ...extra.headers }, redirect: extra.redirect || 'manual' });

describe('v2 public route compatibility', { skip: !htmlBuilt && 'client not built' }, () => {
  it('serves the expected status code for shared v1/v2 URLs', async () => {
    const cases = [
      ['/', 200],
      ['/about', 200],
      ['/durga-puja', 200],
      ['/events', 200],
      ['/events/durga-puja-2026', 200],
      ['/gallery', 200],
      ['/get-involved', 200],
      ['/contact?type=volunteer', 200],
      ['/announcements', 200],
      ['/announcements/durga-puja-2026-invitation', 200],
      ['/register', 200],
      ['/register/durga-puja-2026', 200],
      ['/c/bad-token', 404],
      ['/admin', 200],
      ['/scan', 200],
      ['/unknown-route', 404],
    ];

    for (const [url, status] of cases) {
      assert.equal((await html(url)).status, status, url);
    }
  });

  it('serves v2-only routes and injects sponsor link-preview metadata', async () => {
    assert.equal((await html('/give')).status, 200);
    assert.equal((await html('/passes')).status, 200);
    const sponsor = await html('/sponsor/durga-puja-2026');
    assert.equal(sponsor.status, 200);
    const page = await sponsor.text();
    assert.match(page, /<title>Sponsor Durga Puja 2026 · Parbon Sanskritik Samity<\/title>/);
    assert.match(page, /og:url" content="https:\/\/parbon\.example\/sponsor\/durga-puja-2026"/);
  });

  it('includes v2-only sitemap URLs', async () => {
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/give<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/passes<\/loc>/);
  });
});

