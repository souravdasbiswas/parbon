import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// A server started without the admin settings (like parbon.in when the host passes none).
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-noadmin-'));
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  MEDIA_DIR: path.join(tmp, 'media'),
  // Empty strings (not undefined), so a local .env can't fill them in.
  ADMIN_USERNAME: '',
  ADMIN_PASSWORD_HASH: '',
  SESSION_SECRET: 'short',
  SITE_URL: '',
  SMTP_HOST: '',
});

const { createApp } = await import('../src/app.js');
const { configReportLines } = await import('../src/utils/configReport.js');

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

describe('admin sign-in not configured', () => {
  it('says so in the start-up report', () => {
    const lines = configReportLines().join('\n');
    assert.match(lines, /admin sign-in=OFF \(ADMIN_USERNAME missing, ADMIN_PASSWORD_HASH missing, SESSION_SECRET too short\)/);
    assert.match(lines, /site_url=not set \(localhost\)/);
    assert.match(lines, /set but empty: .*ADMIN_USERNAME/);
  });

  it('logs the reason and the missing settings on each attempt, and health shows it', async () => {
    const lines = [];
    const warn = console.warn;
    console.warn = (...a) => lines.push(a.join(' '));
    let res;
    try {
      res = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ username: 'admin', password: 'whatever-password' }),
      });
    } finally {
      console.warn = warn;
    }
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, 'ADMIN_DISABLED');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[parbon\]\[auth\] admin sign-in FAILED reason=not_configured user=a\*\*\*\(5\) ip=\S+ missing=ADMIN_USERNAME_missing,ADMIN_PASSWORD_HASH_missing,SESSION_SECRET_too_short$/);
    assert.ok(!lines[0].includes('whatever-password'));
    assert.equal((await (await fetch(`${base}/api/health`)).json()).admin, 'not_configured');
  });
});
