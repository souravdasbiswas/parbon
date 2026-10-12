import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Sponsors in MySQL. The whole record is stored as JSON in `data`; the columns next to it
 * are copies used for ordering.
 */
const COLUMNS = 'id, sort_order, status, created_at, updated_at, data';

function toRow(s) {
  const now = new Date().toISOString();
  const record = { ...s, createdAt: s.createdAt || now, updatedAt: s.updatedAt || s.createdAt || now };
  return [
    record.id,
    Number(record.sortOrder) || 0,
    record.status === 'hidden' ? 'hidden' : 'published',
    record.createdAt,
    record.updatedAt,
    JSON.stringify(record),
  ];
}

export const sponsorsTable = {
  async all(db) {
    const [rows] = await db.query('SELECT data FROM sponsors');
    return rows.map((r) => JSON.parse(r.data));
  },

  /** With `ignore`, an existing id is left untouched (used for seeds). */
  async insert(db, record, { ignore = false } = {}) {
    const [result] = await db.query(`INSERT ${ignore ? 'IGNORE ' : ''}INTO sponsors (${COLUMNS}) VALUES (?)`, [toRow(record)]);
    return result.affectedRows > 0;
  },

  async update(db, record) {
    const [id, sortOrder, status, createdAt, updatedAt, data] = toRow(record);
    const [result] = await db.query(
      'UPDATE sponsors SET sort_order = ?, status = ?, created_at = ?, updated_at = ?, data = ? WHERE id = ?',
      [sortOrder, status, createdAt, updatedAt, data, id],
    );
    return result.affectedRows > 0;
  },

  async remove(db, id) {
    const [result] = await db.query('DELETE FROM sponsors WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

export async function readSeedSponsors() {
  const file = path.join(config.paths.data, 'sponsors.seed.json');
  if (!existsSync(file)) return [];
  return JSON.parse(await readFile(file, 'utf8')).sponsors || [];
}

/** Adds seed sponsors that were never merged before; one an admin deleted is not re-added. */
export async function syncSponsorSeed(db, seed) {
  const [rows] = await db.query('SELECT id FROM sponsor_seeds');
  const seeded = new Set(rows.map((r) => r.id));
  const fresh = seed.filter((s) => s.id && !seeded.has(s.id));
  for (const s of fresh) await sponsorsTable.insert(db, s, { ignore: true });
  if (fresh.length) {
    const now = new Date().toISOString();
    await db.query('INSERT IGNORE INTO sponsor_seeds (id, seeded_at) VALUES ?', [fresh.map((s) => [s.id, now])]);
  }
  return fresh.length;
}
