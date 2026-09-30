import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-site-'));
const dataDir = path.join(tmp, 'data');
process.env.DATA_DIR = dataDir;
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.SMTP_HOST = '';
process.env.DB_NAME = '';
process.env.DB_USER = '';

await mkdir(dataDir, { recursive: true });
await writeFile(
  path.join(dataDir, 'site.json'),
  JSON.stringify({
    name: { en: 'Parbon', bn: 'পার্বণ' },
    contact: {
      people: [
        { name: 'Public Person', role: { en: 'Coordinator', bn: '' }, phone: '+91 1', whatsapp: '', public: true },
        { name: 'Default Public', role: { en: '', bn: '' }, phone: '', whatsapp: '+91 2' },
        { name: 'Private Person', role: { en: 'Internal', bn: '' }, phone: '+91 3', whatsapp: '', public: false },
      ],
      whatsappCommunity: 'https://chat.whatsapp.com/CwmIJ4iGN3zLXYL6UbeQA3',
    },
  }),
  'utf8',
);

const { createApp } = await import('../src/app.js');

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

describe('/api/site', () => {
  it('returns only public contact people', async () => {
    const res = await fetch(`${base}/api/site`);
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.deepEqual(
      data.contact.people.map((person) => person.name),
      ['Public Person', 'Default Public'],
    );
    assert.equal(data.contact.whatsappCommunity, 'https://chat.whatsapp.com/CwmIJ4iGN3zLXYL6UbeQA3');
  });
});
