import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// Sign-in telemetry: start-up config report and one log line per sign-in attempt (never secrets).
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-telemetry-'));
const PASSWORD = 'shubho-bijoya-secret-2026';
const salt = randomBytes(16);
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
const SECRET = randomBytes(48).toString('base64url');
const HASH = `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  MEDIA_DIR: path.join(tmp, 'media'),
  ADMIN_USERNAME: 'committee',
  ADMIN_PASSWORD_HASH: HASH,
  SESSION_SECRET: SECRET,
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
});

const { createApp } = await import('../src/app.js');
const { ENV_FILE_CANDIDATES, loadEnvFiles } = await import('../src/config.js');
const { configReport, configReportLines, adminProblems } = await import('../src/utils/configReport.js');
const { logSignIn, maskUsername, resetSignInLogThrottle } = await import('../src/services/authLog.js');

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

/** Runs `fn` while capturing console.log / console.warn lines. */
async function capture(fn) {
  const lines = [];
  const { log, warn } = console;
  console.log = (...a) => lines.push(a.join(' '));
  console.warn = (...a) => lines.push(a.join(' '));
  try {
    await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
  return lines.filter((l) => l.startsWith('[parbon][auth]'));
}

const login = (body, headers = {}) =>
  fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...headers }, body: JSON.stringify(body) });

describe('.env loading', () => {
  it('reads the app root and the working folder, host variables win, the first file wins', async () => {
    const a = path.join(tmp, 'root');
    const b = path.join(tmp, 'cwd');
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, '.env'), 'ONE=from-root\nTWO=from-root\n');
    await writeFile(path.join(b, '.env'), 'TWO=from-cwd\nTHREE=from-cwd\nHOSTSET=from-cwd\n');
    await mkdir(path.join(tmp, 'broken', '.env'), { recursive: true }); // a folder named .env can't be read
    const target = { HOSTSET: 'from-host' };
    const result = loadEnvFiles([path.join(a, '.env'), path.join(b, '.env'), path.join(tmp, 'missing', '.env'), path.join(tmp, 'broken', '.env')], target);
    assert.deepEqual(target, { HOSTSET: 'from-host', ONE: 'from-root', TWO: 'from-root', THREE: 'from-cwd' });
    assert.deepEqual(result.map((r) => r.status), ['loaded', 'loaded', 'absent', 'unreadable']);
    assert.deepEqual([result[1].keys, result[1].applied], [3, 1]);
  });

  it('also reads parbon.env in the home folder, which fills settings the host left missing or empty', async () => {
    assert.equal(ENV_FILE_CANDIDATES.at(-1), path.join(os.homedir(), 'parbon.env'));
    const home = path.join(tmp, 'home-parbon.env');
    await writeFile(home, 'DB_NAME=from-home\nADMIN_USERNAME=from-home\nSITE_URL=from-home\nEMPTY_IN_FILE=\n');
    const target = { DB_NAME: '', SITE_URL: 'https://from-host', EMPTY_IN_FILE: '' };
    const [result] = loadEnvFiles([home], target, { fillEmptyFrom: home });
    // Missing and empty host values are filled; a real host value still wins.
    assert.deepEqual(target, { DB_NAME: 'from-home', ADMIN_USERNAME: 'from-home', SITE_URL: 'https://from-host', EMPTY_IN_FILE: '' });
    assert.equal(result.applied, 2);
    // Other files never replace an empty host value.
    const other = { DB_NAME: '' };
    loadEnvFiles([home], other, { fillEmptyFrom: '' });
    assert.equal(other.DB_NAME, '');
  });
});

describe('start-up config report', () => {
  const env = {
    NODE_ENV: 'production',
    PORT: '3000',
    admin_username: 'x',
    'SITE_URL ': 'https://parbon.in',
    ADMIN_PASSWORD_HASH: '"plain-password-here"',
    SESSION_SECRET: 'too-short-secret',
    DB_NAME: 'u1_parbon',
    DB_USER: 'u1_parbon',
    DB_PASSWORD: 'db-password-value',
    SMTP_HOST: ' smtp.hostinger.com',
    MAIL_TO: '',
    HOSTINGER_THING: '1',
  };
  const report = configReport(env);
  const lines = configReportLines(report).join('\n');

  it('lists what is missing, near-miss names and value problems', () => {
    assert.ok(report.missing.includes('ADMIN_USERNAME') && report.missing.includes('SITE_URL'));
    assert.deepEqual(report.empty, ['MAIL_TO']);
    assert.deepEqual(report.nearMisses.map((m) => m.looksLike).sort(), ['ADMIN_USERNAME', 'SITE_URL']);
    assert.ok(report.problems.some((p) => p.startsWith('ADMIN_PASSWORD_HASH is wrapped in quotes')));
    assert.ok(report.problems.some((p) => p.startsWith('ADMIN_PASSWORD_HASH is not a hash')));
    assert.ok(report.problems.some((p) => p.startsWith('SESSION_SECRET is too short (16')));
    assert.ok(report.problems.some((p) => p.startsWith('SMTP_HOST has spaces')));
    assert.deepEqual(report.features.admin, ['ADMIN_USERNAME missing', 'SESSION_SECRET too short']);
    assert.equal(report.features.storage, 'mysql');
    assert.ok(report.otherVariables.includes('HOSTINGER_THING'));
    assert.match(lines, /\[parbon\]\[config\] admin sign-in=OFF \(ADMIN_USERNAME missing, SESSION_SECRET too short\)/);
    assert.match(lines, /names that look like Parbon settings but don't match exactly: "admin_username"→ADMIN_USERNAME, "SITE_URL "→SITE_URL/);
  });

  it('never prints a value', () => {
    for (const secret of ['plain-password-here', 'too-short-secret', 'db-password-value', 'u1_parbon', 'smtp.hostinger.com', 'https://parbon.in']) {
      assert.ok(!lines.includes(secret), `leaked ${secret}`);
      assert.ok(!JSON.stringify(report).includes(secret), `report leaked ${secret}`);
    }
  });

  it('reports this server as ready', () => {
    assert.deepEqual(adminProblems(), []);
    const own = configReportLines().join('\n');
    assert.match(own, /admin sign-in=ON/);
    assert.ok(!own.includes(SECRET) && !own.includes(HASH));
  });
});

describe('sign-in log lines', () => {
  it('masks usernames that are not the account', () => {
    assert.equal(maskUsername('somebody'), 'so***(8)');
    assert.equal(maskUsername('abc'), 'a***(3)');
    assert.equal(maskUsername(''), '(empty)');
  });

  it('throttles lines anyone can trigger and reports how many were skipped', () => {
    resetSignInLogThrottle();
    const entry = { who: 'admin', ok: false, reason: 'bad_origin', ip: '198.51.100.9', throttle: true };
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.ok(logSignIn(entry));
      assert.equal(logSignIn(entry), null);
      assert.equal(logSignIn(entry), null);
      assert.ok(logSignIn({ ...entry, ip: '198.51.100.10' }), 'another network is logged');
    } finally {
      console.warn = warn;
    }
    resetSignInLogThrottle();
  });

  it('logs each outcome with its reason and never the password', async () => {
    const lines = await capture(async () => {
      assert.equal((await login({ username: 'committee', password: 'wrong-password-1' })).status, 401);
      assert.equal((await login({ username: 'hunter2-typed-here', password: 'wrong-password-2' })).status, 401);
      assert.equal((await login({ username: 'committee', password: '' })).status, 401);
      assert.equal((await login({ username: 'committee', password: PASSWORD })).status, 200);
      assert.equal((await login({ username: 'committee', password: PASSWORD }, { Origin: 'https://evil.example' })).status, 403);
    });
    assert.match(lines[0], /^\[parbon\]\[auth\] admin sign-in FAILED reason=wrong_password user=committee ip=\S+$/);
    assert.match(lines[1], /reason=unknown_username user=hu\*\*\*\(18\)/);
    assert.match(lines[2], /reason=missing_fields user=committee/);
    assert.match(lines[3], /^\[parbon\]\[auth\] admin sign-in OK user=committee ip=/);
    assert.match(lines[4], /reason=bad_origin .*origin=https:\/\/evil\.example expected=/);
    const all = lines.join('\n');
    for (const secret of [PASSWORD, 'wrong-password-1', 'wrong-password-2', 'hunter2-typed-here', SECRET, HASH]) assert.ok(!all.includes(secret), `leaked ${secret}`);
  });

  it('keeps a crafted username on one log line', async () => {
    const lines = await capture(() => login({ username: 'ab\n[parbon][auth] admin sign-in OK user=committee', password: 'x' }));
    assert.equal(lines.length, 1);
    assert.ok(!lines[0].includes('\n'));
  });

  it('logs rate limiting once a minute per network, however many requests are blocked', async () => {
    const lines = await capture(async () => {
      let status = 401;
      for (let i = 0; i < 12 && status !== 429; i += 1) status = (await login({ username: 'committee', password: `guess-${i}` })).status;
      assert.equal(status, 429);
      for (let i = 0; i < 5; i += 1) assert.equal((await login({ username: 'committee', password: 'x' })).status, 429);
    });
    const limited = lines.filter((l) => l.includes('reason=rate_limited'));
    assert.equal(limited.length, 1, limited.join('\n'));
    assert.match(limited[0], /limit=10_per_15min/);
  });

  it('shows coarse flags in health', async () => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.admin, 'ready');
    assert.equal(health.email, 'off');
  });
});
