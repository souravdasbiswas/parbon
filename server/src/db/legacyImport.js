import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { announcementsTable } from './announcementsTable.js';

/**
 * One-way import of the old file storage into MySQL. Source files are only read, never changed.
 * Each file is recorded by content hash in `data_imports`, so it's imported once; rows use
 * INSERT IGNORE, so nothing already in the database is overwritten or duplicated.
 */
const IMAGE_RE = /^[\w.-]+\.(jpe?g|png|webp)$/i;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const cut = (value, max) => (value == null ? null : String(value).slice(0, max));
const firstExisting = (candidates) => candidates.find((dir) => existsSync(dir)) || null;

/** An old app folder may be given as the app root, the `server` folder or the storage folder itself. */
export const storageDirFor = (dir) => firstExisting([path.join(dir, 'server', 'storage'), path.join(dir, 'storage'), dir]);
export const mediaDirFor = (dir) =>
  firstExisting([path.join(dir, 'server', 'media', 'announcements'), path.join(dir, 'media', 'announcements'), path.join(dir, 'announcements')]);

async function once(db, kind, buffer, run) {
  const source = `${kind}:${sha256(buffer)}`;
  const [rows] = await db.query('SELECT 1 FROM data_imports WHERE source = ?', [source]);
  if (rows.length) return 0;
  const count = await run();
  await db.query('INSERT IGNORE INTO data_imports (source, rows_imported, imported_at) VALUES (?, ?, ?)', [
    source,
    count,
    new Date().toISOString(),
  ]);
  return count;
}

async function importAnnouncements(db, file) {
  const buffer = await readFile(file);
  return once(db, 'announcements', buffer, async () => {
    const store = JSON.parse(buffer.toString('utf8'));
    const list = (store.announcements || []).filter((a) => a && a.id && a.slug);
    let added = 0;
    for (const a of list) if (await announcementsTable.insert(db, a, { ignore: true })) added += 1;
    // Stores written before `seeded` existed were copied from the seed, so their entries count as seeded.
    await announcementsTable.markSeeded(db, store.seeded || list.map((a) => a.id));
    return added;
  });
}

async function importInquiries(db, file) {
  const buffer = await readFile(file);
  return once(db, 'inquiries', buffer, async () => {
    const rows = [];
    for (const line of buffer.toString('utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (!r?.id || !r.createdAt) continue;
        rows.push([
          cut(r.id, 64),
          cut(r.createdAt, 32),
          cut(r.type || 'general', 32),
          cut(r.name || '', 191),
          cut(r.email || '', 255),
          cut(r.phone, 40),
          String(r.message || ''),
          cut(r.meta?.ip, 64),
          cut(r.meta?.userAgent, 400),
          'import',
        ]);
      } catch {
        // Damaged line: skipped (the Responses page already reports these for the file store).
      }
    }
    if (!rows.length) return 0;
    const [result] = await db.query(
      'INSERT IGNORE INTO inquiries (id, created_at, type, name, email, phone, message, ip, user_agent, source) VALUES ?',
      [rows],
    );
    return result.affectedRows;
  });
}

async function importImages(db, dir) {
  let added = 0;
  for (const name of await readdir(dir)) {
    if (!IMAGE_RE.test(name)) continue;
    const file = path.join(dir, name);
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) continue;
    const ext = name.split('.').pop().toLowerCase();
    const [result] = await db.query('INSERT IGNORE INTO media (name, mime, size, bytes, created_at) VALUES (?, ?, ?, ?, ?)', [
      name,
      MIME[ext],
      info.size,
      await readFile(file),
      info.mtime.toISOString(),
    ]);
    added += result.affectedRows;
  }
  return added;
}

/** Imports announcements, form responses and uploaded images from the given folders. */
export async function importLegacyData(db, { storageDirs = [], mediaDirs = [] } = {}) {
  const totals = { announcements: 0, inquiries: 0, images: 0 };
  for (const dir of new Set(storageDirs.filter(Boolean))) {
    try {
      const announcements = path.join(dir, 'announcements.json');
      const inquiries = path.join(dir, 'inquiries.ndjson');
      if (existsSync(announcements)) totals.announcements += await importAnnouncements(db, announcements);
      if (existsSync(inquiries)) totals.inquiries += await importInquiries(db, inquiries);
    } catch (error) {
      console.error(`[parbon] could not import files from ${dir}:`, error.message);
    }
  }
  for (const dir of new Set(mediaDirs.filter(Boolean))) {
    try {
      if (existsSync(dir)) totals.images += await importImages(db, dir);
    } catch (error) {
      console.error(`[parbon] could not import images from ${dir}:`, error.message);
    }
  }
  if (totals.announcements || totals.inquiries || totals.images) {
    console.log(
      `[parbon] imported into MySQL: ${totals.announcements} announcements, ${totals.inquiries} form responses, ${totals.images} images`,
    );
  }
  return totals;
}
