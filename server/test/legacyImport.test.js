import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { findPreviousDeployments, mediaDirFor, scanLegacyData, storageDirFor } from '../src/db/legacyImport.js';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-legacy-'));
after(() => rm(tmp, { recursive: true, force: true }));

// Hostinger layout: …/hbuilds/versions/<id>/nodejs — one folder per deployment.
const versions = path.join(tmp, 'domains', 'parbon.in', 'hbuilds', 'versions');
const app = (id) => path.join(versions, id, 'nodejs');

describe('finding earlier Hostinger deployments', () => {
  it('lists the other deployment folders, newest first, and skips the running one', async () => {
    for (const [id, age] of [
      ['aaa', 3],
      ['bbb', 1],
      ['ccc', 2],
      ['current', 0],
    ]) {
      await mkdir(path.join(app(id), 'server', 'storage'), { recursive: true });
      const t = new Date(Date.now() - age * 86_400_000);
      await utimes(app(id), t, t);
    }
    await mkdir(path.join(versions, 'no-app-folder'), { recursive: true });
    assert.deepEqual(await findPreviousDeployments(app('current')), [app('bbb'), app('ccc'), app('aaa')]);
  });

  it('does nothing outside the Hostinger layout', async () => {
    assert.deepEqual(await findPreviousDeployments(path.join(tmp, 'somewhere', 'else')), []);
  });

  it('accepts an app folder, a server folder or a storage folder', async () => {
    await mkdir(path.join(app('bbb'), 'server', 'media', 'announcements'), { recursive: true });
    assert.equal(storageDirFor(app('bbb')), path.join(app('bbb'), 'server', 'storage'));
    assert.equal(storageDirFor(path.join(app('bbb'), 'server')), path.join(app('bbb'), 'server', 'storage'));
    assert.equal(mediaDirFor(app('bbb')), path.join(app('bbb'), 'server', 'media', 'announcements'));
    assert.equal(mediaDirFor(app('aaa')), null);
  });

  it('dry run counts what the old files contain', async () => {
    const storage = path.join(app('bbb'), 'server', 'storage');
    await writeFile(path.join(storage, 'announcements.json'), JSON.stringify({ announcements: [{ id: 'a' }, { id: 'b' }] }));
    await writeFile(path.join(storage, 'inquiries.ndjson'), '{"id":"1"}\n{"id":"2"}\n\n{"id":"3"}\n');
    await writeFile(path.join(app('bbb'), 'server', 'media', 'announcements', 'x.jpg'), 'img');
    const found = await scanLegacyData({ storageDirs: [storage], mediaDirs: [mediaDirFor(app('bbb'))] });
    assert.deepEqual(
      found.map((f) => [path.basename(f.file), f.rows]),
      [
        ['announcements.json', 2],
        ['inquiries.ndjson', 3],
        ['announcements', 1],
      ],
    );
  });
});
