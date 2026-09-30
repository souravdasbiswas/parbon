import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const storageDir = await mkdtemp(path.join(os.tmpdir(), 'parbon-ui-version-'));
Object.assign(process.env, {
  STORAGE_DIR: storageDir,
  SMTP_HOST: '',
  SITE_URL: 'https://parbon.example',
  UI_VERSION: 'v1',
  UI_PREVIEW: 'false',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: 'configured-for-session-tests',
  SESSION_SECRET: randomBytes(48).toString('base64url'),
});

const { createApp, isKnownClientRoute } = await import('../src/app.js');
const { config } = await import('../src/config.js');
const { createSessionToken, SESSION_COOKIE } = await import('../src/services/authService.js');
const { UI_PREVIEW_COOKIE } = await import('../src/services/uiVersionService.js');
const { resolveConfiguredUiVersion } = await import('../src/uiVersions.js');

let server;
let base;
let adminCookie;

before(async () => {
  adminCookie = `${SESSION_COOKIE}=${createSessionToken('admin')}`;
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

describe('UI version configuration', () => {
  it('validates configured versions and falls back to v1 for invalid values', () => {
    assert.equal(resolveConfiguredUiVersion('v2').version, 'v2');
    const invalid = resolveConfiguredUiVersion('future');
    assert.equal(invalid.version, 'v1');
    assert.match(invalid.warning, /Invalid UI_VERSION "future"/);
  });

  it('reports configured UI state in health', async () => {
    const body = await (await fetch(`${base}/api/health`)).json();
    assert.deepEqual(body.ui, { version: 'v1', preview: false });
  });
});

describe('UI preview resolution', { skip: !htmlBuilt && 'client not built' }, () => {
  it('ignores query and cookie overrides without preview or admin session', async () => {
    const res = await getHtml('/?ui=v2', { Cookie: `${UI_PREVIEW_COOKIE}=v2` });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('set-cookie'), null);
    const page = await res.text();
    assert.match(page, /<html[^>]* data-ui="v1"/);
    assert.match(page, /<meta name="parbon-ui" content="v1" \/>/);
    assert.doesNotMatch(page, /parbon-ui-preview/);
  });

  it('honours query overrides for valid admin sessions', async () => {
    const res = await getHtml('/?ui=v2', { Cookie: adminCookie });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /parbon_ui=v2/);
    const page = await res.text();
    assert.match(page, /<html[^>]* data-ui="v2"/);
    assert.match(page, /<meta name="parbon-ui-preview" content="1" \/>/);
  });

  it('resets the preview cookie for valid admin sessions', async () => {
    const res = await getHtml('/?ui=reset', { Cookie: `${adminCookie}; ${UI_PREVIEW_COOKIE}=v2` });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /parbon_ui=;/);
    const page = await res.text();
    assert.match(page, /<meta name="parbon-ui" content="v1" \/>/);
    assert.doesNotMatch(page, /parbon-ui-preview/);
  });
});

describe('version-aware routes and sitemap', { skip: !htmlBuilt && 'client not built' }, () => {
  it('injects UI metadata into normal and rich-preview HTML responses', async () => {
    const home = await (await getHtml('/')).text();
    assert.match(home, /<meta name="parbon-ui" content="v1" \/>/);
    assert.match(home, /<link rel="modulepreload" href="\/assets\//);

    const announcement = await (await getHtml('/announcements/durga-puja-2026-invitation')).text();
    assert.match(announcement, /og:title/);
    assert.match(announcement, /<meta name="parbon-ui" content="v1" \/>/);
  });

  it('redirects v2-only URLs while v1 is active', async () => {
    const give = await getHtml('/give');
    assert.equal(give.status, 302);
    assert.equal(new URL(give.headers.get('location'), base).pathname, '/get-involved');

    const sponsor = await getHtml('/sponsor/durga-puja-2026');
    assert.equal(sponsor.status, 302);
    assert.equal(new URL(sponsor.headers.get('location'), base).pathname, '/events/durga-puja-2026');

    const passes = await getHtml('/passes');
    assert.equal(passes.status, 302);
    assert.equal(new URL(passes.headers.get('location'), base).pathname, '/register');
  });

  it('knows v2-only client paths only for v2', async () => {
    assert.equal(await isKnownClientRoute('/give', 'v1'), false);
    assert.equal(await isKnownClientRoute('/give', 'v2'), true);
    assert.equal(await isKnownClientRoute('/sponsor/durga-puja-2026', 'v2'), true);
  });

  it('omits v2-only URLs from the v1 sitemap', async () => {
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.doesNotMatch(sitemap, /<loc>https:\/\/parbon\.example\/give<\/loc>/);
    assert.doesNotMatch(sitemap, /<loc>https:\/\/parbon\.example\/passes<\/loc>/);
    assert.doesNotMatch(sitemap, /<loc>https:\/\/parbon\.example\/sponsor<\/loc>/);
  });
});
