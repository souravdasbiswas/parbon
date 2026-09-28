import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Announcements in MySQL. The whole record is stored as JSON in `data`; the columns next to it
 * are copies used for uniqueness and ordering.
 */
const COLUMNS = 'id, slug, status, pinned, published_at, created_at, updated_at, data';

function toRow(a) {
  const now = new Date().toISOString();
  const record = {
    ...a,
    createdAt: a.createdAt || now,
    updatedAt: a.updatedAt || a.createdAt || now,
    publishedAt: a.publishedAt || a.createdAt || now,
  };
  return [
    record.id,
    record.slug,
    record.status === 'draft' ? 'draft' : 'published',
    record.pinned ? 1 : 0,
    record.publishedAt,
    record.createdAt,
    record.updatedAt,
    JSON.stringify(record),
  ];
}

export const announcementsTable = {
  async all(db) {
    const [rows] = await db.query('SELECT data FROM announcements');
    return rows.map((r) => JSON.parse(r.data));
  },

  /** With `ignore`, an existing id or slug is left untouched (used for seeds and imports). */
  async insert(db, record, { ignore = false } = {}) {
    const [result] = await db.query(`INSERT ${ignore ? 'IGNORE ' : ''}INTO announcements (${COLUMNS}) VALUES (?)`, [toRow(record)]);
    return result.affectedRows > 0;
  },

  async update(db, record) {
    const [id, slug, status, pinned, publishedAt, createdAt, updatedAt, data] = toRow(record);
    const [result] = await db.query(
      'UPDATE announcements SET slug = ?, status = ?, pinned = ?, published_at = ?, created_at = ?, updated_at = ?, data = ? WHERE id = ?',
      [slug, status, pinned, publishedAt, createdAt, updatedAt, data, id],
    );
    return result.affectedRows > 0;
  },

  async remove(db, id) {
    const [result] = await db.query('DELETE FROM announcements WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async seededIds(db) {
    const [rows] = await db.query('SELECT id FROM announcement_seeds');
    return new Set(rows.map((r) => r.id));
  },

  async markSeeded(db, ids) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    await db.query('INSERT IGNORE INTO announcement_seeds (id, seeded_at) VALUES ?', [ids.map((id) => [id, now])]);
  },
};

export async function readSeedAnnouncements() {
  const file = path.join(config.paths.data, 'announcements.seed.json');
  if (!existsSync(file)) return [];
  return JSON.parse(await readFile(file, 'utf8')).announcements || [];
}

/** Adds seed entries that were never merged before; an entry an admin deleted is not re-added. */
export async function syncAnnouncementSeed(db, seed) {
  const seeded = await announcementsTable.seededIds(db);
  const fresh = seed.filter((a) => a.id && a.slug && !seeded.has(a.id));
  for (const a of fresh) await announcementsTable.insert(db, a, { ignore: true });
  await announcementsTable.markSeeded(
    db,
    fresh.map((a) => a.id),
  );
  return fresh.length;
}
