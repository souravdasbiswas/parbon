import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// A live site whose store was seeded before the Durga Puja schedule was corrected (seedRevision 2).
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-seed-rev-'));
const storage = path.join(tmp, 'storage');
Object.assign(process.env, {
  STORAGE_DIR: storage,
  MEDIA_DIR: path.join(tmp, 'media'),
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'https://parbon.example',
  SMTP_HOST: '',
  DB_NAME: '',
  DB_USER: '',
});

const seedFile = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const seedPuja = seedFile.events.find((e) => e.slug === 'durga-puja-2026');
const oldPuja = {
  ...Object.fromEntries(Object.entries(seedPuja).filter(([k]) => !['seedRevision', 'seedUpdates', 'image'].includes(k))),
  startDate: '2026-10-16',
  countdown: { ...seedPuja.countdown, time: '07:00' },
  venue: { ...seedPuja.venue, name: { en: 'Nirusa Banquets & Caterers', bn: '' } },
  schedule: [{ date: '2026-10-16', day: { en: 'Maha Shashthi', bn: 'মহাষষ্ঠী' }, items: [{ time: '7:00 AM', title: { en: 'Bodhon', bn: 'বোধন' } }] }],
  summary: { en: 'Edited by an admin.', bn: '' },
};

await mkdir(storage, { recursive: true });
await writeFile(
  path.join(storage, 'events.json'),
  JSON.stringify({ events: [oldPuja], seeded: seedFile.events.map((e) => e.id) }),
);

const { createApp } = await import('../src/app.js');
const { applySeedRevision, seedRecord, seedRevisionKey, syncEventSeed } = await import('../src/db/eventsTable.js');

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

describe('seed revisions (file store)', () => {
  it('copies the corrected schedule, dates, venue and poster onto the stored event once', async () => {
    const res = await fetch(`${base}/api/events/durga-puja-2026`);
    const puja = (await res.json()).data;
    assert.deepEqual(puja.schedule, seedPuja.schedule);
    assert.equal(puja.startDate, '2026-10-15');
    assert.equal(puja.countdownTo, '2026-10-16T18:00:00+05:30');
    assert.deepEqual(puja.venue, seedPuja.venue);
    assert.deepEqual(puja.image, seedPuja.image);
    assert.equal(puja.summary.en, 'Edited by an admin.', 'fields outside seedUpdates keep the admin’s edits');
    assert.equal(puja.seedRevision, undefined);

    const store = JSON.parse(await readFile(path.join(storage, 'events.json'), 'utf8'));
    assert.ok(store.seeded.includes('seed-durga-puja-2026@r2'));
    assert.equal(store.events.length, 1, 'events an admin deleted are not re-added');
  });
});

describe('seed revisions (MySQL)', () => {
  // Just enough of the mysql2 pool for syncEventSeed.
  const fakeDb = (events, seeds) => ({
    events,
    seeds,
    async query(sql, params) {
      if (sql.startsWith('SELECT id FROM event_seeds')) return [[...this.seeds].map((id) => ({ id }))];
      if (sql.startsWith('SELECT data FROM site_events')) {
        const e = this.events.get(params[0]);
        return [e ? [{ data: JSON.stringify(e) }] : []];
      }
      if (sql.includes('INTO site_events')) {
        const [row] = params;
        if (!this.events.has(row[0])) this.events.set(row[0], JSON.parse(row.at(-1)));
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE site_events')) {
        this.events.set(params.at(-1), JSON.parse(params.at(-2)));
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INTO event_seeds')) {
        for (const [id] of params[0]) this.seeds.add(id);
        return [{ affectedRows: params[0].length }];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  });

  it('applies a revision once, so later admin edits are kept', async () => {
    const db = fakeDb(new Map([[oldPuja.id, oldPuja]]), new Set([oldPuja.id]));
    assert.equal(await syncEventSeed(db, [seedPuja]), 0);
    assert.deepEqual(db.events.get(oldPuja.id).schedule, seedPuja.schedule);
    assert.equal(db.events.get(oldPuja.id).summary.en, 'Edited by an admin.');
    assert.ok(db.seeds.has('seed-durga-puja-2026@r2'));

    db.events.set(oldPuja.id, { ...db.events.get(oldPuja.id), schedule: [] });
    await syncEventSeed(db, [seedPuja]);
    assert.deepEqual(db.events.get(oldPuja.id).schedule, [], 'an applied revision is not applied again');
  });

  it('stores a new seed event without its bookkeeping and marks its revision as applied', async () => {
    const db = fakeDb(new Map(), new Set());
    assert.equal(await syncEventSeed(db, [seedPuja]), 1);
    assert.equal(db.events.get(seedPuja.id).seedRevision, undefined);
    assert.ok(db.seeds.has(seedPuja.id) && db.seeds.has('seed-durga-puja-2026@r2'));
  });

  it('marks a revision for an event the admin deleted without re-adding it', async () => {
    const db = fakeDb(new Map(), new Set([seedPuja.id]));
    await syncEventSeed(db, [seedPuja]);
    assert.equal(db.events.size, 0);
    assert.ok(db.seeds.has('seed-durga-puja-2026@r2'));
  });
});

describe('seed revision helpers', () => {
  it('needs a revision above 1 and a list of fields', () => {
    assert.equal(seedRevisionKey({ id: 'a', slug: 'a', seedRevision: 2, seedUpdates: ['schedule'] }), 'a@r2');
    assert.equal(seedRevisionKey({ id: 'a', slug: 'a', seedRevision: 1, seedUpdates: ['schedule'] }), null);
    assert.equal(seedRevisionKey({ id: 'a', slug: 'a', seedRevision: 2 }), null);
    assert.equal(seedRevisionKey({ id: 'a', slug: 'a' }), null);
  });

  it('never changes the id or slug, and drops fields the seed no longer has', () => {
    const next = applySeedRevision({ id: 'a', slug: 'a', image: { src: 'x' }, title: 't' }, { id: 'b', slug: 'b', seedUpdates: ['id', 'slug', 'image', 'title'], title: 'new' }, 'now');
    assert.deepEqual(next, { id: 'a', slug: 'a', title: 'new', updatedAt: 'now' });
    assert.deepEqual(seedRecord({ id: 'a', seedRevision: 2, seedUpdates: [] }), { id: 'a' });
  });
});
