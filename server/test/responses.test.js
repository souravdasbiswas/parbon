import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-responses-'));
const storage = path.join(tmp, 'storage');
const file = path.join(storage, 'inquiries.ndjson');
const PASSWORD = 'sandhi-puja-108-lamps';
const salt = randomBytes(16);
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
Object.assign(process.env, {
  STORAGE_DIR: storage,
  MEDIA_DIR: path.join(tmp, 'media'),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'http://localhost',
  SMTP_HOST: '',
});

const records = [
  {
    id: 'aaaa1111-0000-4000-8000-000000000001',
    createdAt: '2026-09-27T15:32:00.000Z',
    type: 'membership',
    name: 'Rahul Das',
    email: 'rahul@example.com',
    message: 'We moved to Nallagandla and would love to join.',
    meta: { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' },
  },
  {
    id: 'bbbb2222-0000-4000-8000-000000000002',
    createdAt: '2026-09-28T04:45:00.000Z',
    type: 'volunteer',
    name: 'Ananya Sen',
    email: 'ananya@example.com',
    phone: '+91 98765 43210',
    message: 'আমি ভোগঘরে সাহায্য করতে চাই, "Ashtami" morning.\nThanks!',
    meta: { ip: '198.51.100.4', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36' },
  },
  {
    id: 'cccc3333-0000-4000-8000-000000000003',
    createdAt: '2026-09-26T10:00:00.000Z',
    type: 'volunteer',
    name: '=HYPERLINK("http://evil.example")',
    email: 'bob@example.com',
    message: 'Happy to help with decoration, lights, and more.',
    meta: {},
  },
];
const fixture = `${records.map((r) => JSON.stringify(r)).join('\n')}\n{"id":"broken",\n\n`;
await mkdir(storage, { recursive: true });
await writeFile(file, fixture, 'utf8');
const sha = async () => createHash('sha256').update(await readFile(file)).digest('hex');
const originalHash = await sha();

const { createApp } = await import('../src/app.js');

let server;
let base;
let cookie = '';

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ username: 'admin', password: PASSWORD }),
  });
  cookie = res.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const get = (p, { auth = true } = {}) => fetch(`${base}/api/admin${p}`, { headers: auth ? { Cookie: cookie } : {} });
const list = async (qs = '') => (await (await get(`/responses${qs}`)).json()).data;

describe('admin responses', () => {
  it('requires sign-in', async () => {
    assert.equal((await get('/responses', { auth: false })).status, 401);
    assert.equal((await get('/responses/export.csv', { auth: false })).status, 401);
  });

  it('lists every valid record newest first, counts types and reports damaged lines', async () => {
    const res = await get('/responses');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = (await res.json()).data;
    assert.deepEqual(
      data.items.map((r) => r.name),
      ['Ananya Sen', 'Rahul Das', '=HYPERLINK("http://evil.example")'],
    );
    assert.equal(data.total, 3);
    assert.equal(data.skipped, 1);
    assert.equal(data.lastReceivedAt, '2026-09-28T04:45:00.000Z');
    assert.deepEqual(data.counts, { all: 3, general: 0, volunteer: 2, membership: 1, sponsorship: 0, performance: 0 });
    const ananya = data.items[0];
    assert.equal(ananya.typeLabel, 'Volunteering');
    assert.equal(ananya.ip, '198.51.100.4');
    assert.match(ananya.userAgent, /Android/);
    assert.match(ananya.message, /ভোগঘরে/);
  });

  it('sorts, filters by type and searches', async () => {
    assert.deepEqual(
      (await list('?sort=name&dir=asc')).items.map((r) => r.name),
      ['=HYPERLINK("http://evil.example")', 'Ananya Sen', 'Rahul Das'],
    );
    // Empty phone numbers stay last in both directions.
    assert.equal((await list('?sort=phone&dir=asc')).items[0].name, 'Ananya Sen');
    assert.equal((await list('?sort=phone&dir=desc')).items[0].name, 'Ananya Sen');
    assert.deepEqual(
      (await list('?sort=createdAt&dir=asc&type=volunteer')).items.map((r) => r.id.slice(0, 4)),
      ['cccc', 'bbbb'],
    );
    const found = await list('?q=9876543210');
    assert.deepEqual(found.items.map((r) => r.name), ['Ananya Sen']);
    assert.equal(found.counts.all, 1);
    assert.equal((await list('?q=ভোগঘরে')).items.length, 1);
    assert.equal((await list('?q=NALLAGANDLA')).items[0].name, 'Rahul Das');
  });

  it('falls back to defaults for unknown parameters', async () => {
    const data = await list('?sort=message;drop&dir=sideways&type=nope');
    assert.deepEqual(data.query, { sort: 'createdAt', dir: 'desc', type: '', q: '' });
    assert.equal(data.items.length, 3);
  });

  it('exports the filtered, sorted view as an Excel-friendly CSV', async () => {
    const res = await get('/responses/export.csv?type=volunteer&sort=createdAt&dir=desc');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="parbon-responses-\d{4}-\d{2}-\d{2}\.csv"$/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8').slice(1);
    const rows = text.split('\r\n');
    assert.equal(
      rows[0],
      'Received (IST),Received (ISO),Type,Name,Email,Phone,Message,Reference ID,IP address,Browser (user agent)',
    );
    // 10:15 IST = 04:45 UTC; quotes doubled, embedded newline kept inside quotes.
    assert.ok(
      text.includes(
        '2026-09-28 10:15,2026-09-28T04:45:00.000Z,Volunteering,Ananya Sen,ananya@example.com,+91 98765 43210,"আমি ভোগঘরে সাহায্য করতে চাই, ""Ashtami"" morning.\nThanks!",bbbb2222-0000-4000-8000-000000000002,198.51.100.4,',
      ),
    );
    // Formula injection neutralised.
    assert.ok(text.includes(`"'=HYPERLINK(""http://evil.example"")"`));
    assert.ok(!text.includes('Rahul Das'));
    assert.ok(text.endsWith('\r\n'));
  });

  it('never modifies the responses file', async () => {
    assert.equal(await sha(), originalHash);
  });

  it('neutralises formula cells but keeps phone numbers readable', async () => {
    const { toCsv } = await import('../src/utils/csv.js');
    const csv = toCsv([{ header: 'v', value: (r) => r }], ['+91 98765 43210', '+SUM(A1)', '@cmd', '-42', '-2+3', 'a,b']);
    assert.equal(csv, "\uFEFFv\r\n+91 98765 43210\r\n'+SUM(A1)\r\n'@cmd\r\n-42\r\n'-2+3\r\n\"a,b\"\r\n");
  });

  it('picks up new submissions and returns an empty list when the file is missing', async () => {
    const submitted = await fetch(`${base}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'general', name: 'New Person', email: 'new@example.com', message: 'Hello from the test suite!' }),
    });
    assert.equal(submitted.status, 201);
    const data = await list();
    assert.equal(data.total, 4);
    assert.equal(data.items[0].name, 'New Person');

    await rm(file);
    const empty = await list();
    assert.deepEqual([empty.total, empty.items.length, empty.skipped], [0, 0, 0]);
  });
});
