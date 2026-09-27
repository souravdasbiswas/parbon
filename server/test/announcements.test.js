import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

// A store written before seed tracking existed: an admin post and a seed entry, no `seeded` list.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-seed-'));
const storage = path.join(tmp, 'storage');
const storeFile = path.join(storage, 'announcements.json');
const seed = JSON.parse(await readFile(new URL('../data/announcements.seed.json', import.meta.url), 'utf8')).announcements;
const [newest, original] = seed;
const adminPost = { ...original, id: 'admin-post', slug: 'admin-post', pinned: false, publishedAt: '2026-09-20T00:00:00.000Z' };
await mkdir(storage, { recursive: true });
await writeFile(storeFile, JSON.stringify({ announcements: [original, adminPost] }), 'utf8');
process.env.STORAGE_DIR = storage;

const { announcementService } = await import('../src/services/announcementService.js');

after(() => rm(tmp, { recursive: true, force: true }));

describe('announcement seed sync', () => {
  it('adds new seed entries to an existing store without touching existing ones', async () => {
    const list = await announcementService.listAll();
    assert.deepEqual(
      list.map((a) => a.id),
      [newest.id, original.id, 'admin-post'],
    );
    const stored = JSON.parse(await readFile(storeFile, 'utf8'));
    assert.deepEqual([...stored.seeded].sort(), [original.id, 'admin-post', newest.id].sort());
  });

  it('keeps a deleted seed entry deleted', async () => {
    assert.equal(await announcementService.remove(newest.id), true);
    const stored = JSON.parse(await readFile(storeFile, 'utf8'));
    assert.ok(stored.seeded.includes(newest.id));
    assert.ok(!stored.announcements.some((a) => a.id === newest.id));
    assert.ok(!(await announcementService.listAll()).some((a) => a.id === newest.id));
  });
});
