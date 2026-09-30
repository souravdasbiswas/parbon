import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const storageDir = await mkdtemp(path.join(os.tmpdir(), 'parbon-ui-preview-'));
Object.assign(process.env, {
  STORAGE_DIR: storageDir,
  SMTP_HOST: '',
  SITE_URL: 'https://parbon.example',
  UI_VERSION: 'v1',
  UI_PREVIEW: 'true',
});

const { createApp } = await import('../src/app.js');
const { config } = await import('../src/config.js');
const { UI_PREVIEW_COOKIE } = await import('../src/services/uiVersionService.js');

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
const getHtml = (url, headers = {}) => fetch(`${base}${url}`, { headers: { Accept: 'text/html', ...headers }, redirect: 'manual' });

describe('public UI preview mode', { skip: !htmlBuilt && 'client not built' }, () => {
  it('honours query overrides without an admin session', async () => {
    const res = await getHtml('/?ui=v2');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /parbon_ui=v2/);
    const page = await res.text();
    assert.match(page, /<html[^>]* data-ui="v2"/);
    assert.match(page, /<meta name="parbon-ui-preview" content="1" \/>/);
  });

  it('honours preview cookies without an admin session', async () => {
    const res = await getHtml('/', { Cookie: `${UI_PREVIEW_COOKIE}=v2` });
    assert.equal(res.status, 200);
    const page = await res.text();
    assert.match(page, /<meta name="parbon-ui" content="v2" \/>/);
    assert.match(page, /<meta name="parbon-ui-preview" content="1" \/>/);
  });

  it('serves v2-only paths instead of redirecting while v2 is effective', async () => {
    const res = await getHtml('/give?ui=v2');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
    assert.match(await res.text(), /<meta name="parbon-ui" content="v2" \/>/);
  });

  it('includes v2-only URLs in the v2 sitemap', async () => {
    const sitemap = await (await fetch(`${base}/sitemap.xml?ui=v2`)).text();
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/give<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/passes<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/parbon\.example\/sponsor<\/loc>/);
  });
});
