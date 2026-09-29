import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Website events in MySQL. The whole event is JSON in `data`; the columns beside it are copies used
 * for uniqueness, ordering and the seed bookkeeping (same approach as announcementsTable).
 */
const COLUMNS = 'id, slug, state, published_at, start_date, created_at, updated_at, data';

function toRow(e) {
  const now = new Date().toISOString();
  const record = { ...e, createdAt: e.createdAt || now, updatedAt: e.updatedAt || e.createdAt || now, publishedAt: e.publishedAt || e.createdAt || now };
  return [record.id, record.slug, record.state === 'published' ? 'published' : 'draft', record.publishedAt, record.startDate || null, record.createdAt, record.updatedAt, JSON.stringify(record)];
}

export const eventsTable = {
  async all(db) {
    const [rows] = await db.query('SELECT data FROM site_events');
    return rows.map((r) => JSON.parse(r.data));
  },

  /** With `ignore`, an existing id or slug is left untouched (used for seeds). */
  async insert(db, record, { ignore = false } = {}) {
    const [result] = await db.query(`INSERT ${ignore ? 'IGNORE ' : ''}INTO site_events (${COLUMNS}) VALUES (?)`, [toRow(record)]);
    return result.affectedRows > 0;
  },

  async update(db, record) {
    const [id, slug, state, publishedAt, startDate, createdAt, updatedAt, data] = toRow(record);
    const [result] = await db.query(
      'UPDATE site_events SET slug = ?, state = ?, published_at = ?, start_date = ?, created_at = ?, updated_at = ?, data = ? WHERE id = ?',
      [slug, state, publishedAt, startDate, createdAt, updatedAt, data, id],
    );
    return result.affectedRows > 0;
  },

  async remove(db, id) {
    const [result] = await db.query('DELETE FROM site_events WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

/** The events shipped with the code (server/data/events.json), merged into the store once each. */
export async function readSeedEvents() {
  const file = path.join(config.paths.data, 'events.json');
  if (!existsSync(file)) return [];
  return JSON.parse(await readFile(file, 'utf8')).events || [];
}

/** Adds seed events that were never merged before; an event an admin deleted is not re-added. */
export async function syncEventSeed(db, seed) {
  const [rows] = await db.query('SELECT id FROM event_seeds');
  const seeded = new Set(rows.map((r) => r.id));
  const fresh = seed.filter((e) => e.id && e.slug && !seeded.has(e.id));
  for (const e of fresh) await eventsTable.insert(db, e, { ignore: true });
  if (fresh.length) {
    const now = new Date().toISOString();
    await db.query('INSERT IGNORE INTO event_seeds (id, seeded_at) VALUES ?', [fresh.map((e) => [e.id, now])]);
  }
  return fresh.length;
}
