import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// MySQL is configured but nothing listens on port 1: the site must keep working.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-dbdown-'));
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  DB_HOST: '127.0.0.1',
  DB_PORT: '1',
  DB_NAME: 'parbon',
  DB_USER: 'parbon',
  DB_PASSWORD: 'x',
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
});

const { createApp } = await import('../src/app.js');
const { closeDatabase } = await import('../src/db/index.js');
const seed = JSON.parse(await readFile(new URL('../data/announcements.seed.json', import.meta.url), 'utf8')).announcements;

let server;
let base;
const originalError = console.error;

before(async () => {
  console.error = () => {}; // expected "database is not available" noise
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  console.error = originalError;
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  await rm(tmp, { recursive: true, force: true });
});

describe('when the database is unreachable', () => {
  it('health reports it', async () => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.deepEqual([health.status, health.storage, health.database], ['ok', 'mysql', 'unavailable']);
  });

  it('public announcements, the ticker and shared links fall back to the built-in announcements', async () => {
    const list = (await (await fetch(`${base}/api/announcements`)).json()).data;
    assert.deepEqual(
      list.map((a) => a.id).sort(),
      seed.map((a) => a.id).sort(),
    );
    const ticker = await fetch(`${base}/api/announcements?ticker=1`);
    assert.equal(ticker.status, 200);
    assert.equal((await fetch(`${base}/api/announcements/${seed[0].slug}`)).status, 200);
    assert.equal((await fetch(`${base}/sitemap.xml`)).status, 200);
  });

  it('still saves form submissions (to the fallback file)', async () => {
    const res = await fetch(`${base}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'general', name: 'Offline Test', email: 'o@example.com', message: 'Saved even though MySQL is down.' }),
    });
    assert.equal(res.status, 201);
    assert.ok(existsSync(path.join(tmp, 'storage', 'inquiries.ndjson')));
  });

  it('serves the images shipped with the site', async () => {
    const res = await fetch(`${base}/media/announcements/${path.basename(seed[0].image.src)}`);
    assert.equal(res.status, 200);
  });
});
