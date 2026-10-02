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

const SEED_ONLY = ['seedRevision', 'seedUpdates'];
const LOCKED = ['id', 'slug', ...SEED_ONLY];

/** A seed entry as it is stored: without the seed bookkeeping fields. */
export const seedRecord = (e) => Object.fromEntries(Object.entries(e).filter(([key]) => !SEED_ONLY.includes(key)));

/**
 * A seed entry may carry `seedRevision` (2, 3, …) and `seedUpdates` (field names). The first deploy
 * that sees a new revision copies those fields onto the stored event once — even if an admin edited
 * it — so a corrected schedule in the seed reaches a live site. Later admin edits are kept. Each
 * applied revision is remembered next to the seed ids as "<id>@r<revision>".
 */
export const seedRevisionKey = (e) =>
  e?.id && e.slug && Number.isInteger(e.seedRevision) && e.seedRevision > 1 && Array.isArray(e.seedUpdates) && e.seedUpdates.length
    ? `${e.id}@r${e.seedRevision}`
    : null;

export function applySeedRevision(stored, e, now = new Date().toISOString()) {
  const next = { ...stored, updatedAt: now };
  for (const field of e.seedUpdates) {
    if (typeof field !== 'string' || LOCKED.includes(field)) continue;
    if (e[field] === undefined) delete next[field];
    else next[field] = e[field];
  }
  return next;
}

/**
 * Adds seed events that were never merged before (an event an admin deleted is not re-added) and
 * applies new seed revisions to events already in the store.
 */
export async function syncEventSeed(db, seed) {
  const [rows] = await db.query('SELECT id FROM event_seeds');
  const seeded = new Set(rows.map((r) => r.id));
  const fresh = seed.filter((e) => e.id && e.slug && !seeded.has(e.id));
  for (const e of fresh) await eventsTable.insert(db, seedRecord(e), { ignore: true });
  const marks = fresh.map((e) => e.id);
  for (const e of seed) {
    const key = seedRevisionKey(e);
    if (!key || seeded.has(key)) continue;
    // A freshly added event already has the latest fields.
    if (!fresh.includes(e)) {
      const [found] = await db.query('SELECT data FROM site_events WHERE id = ?', [e.id]);
      if (found.length) await eventsTable.update(db, applySeedRevision(JSON.parse(found[0].data), e));
    }
    marks.push(key);
  }
  if (marks.length) {
    const now = new Date().toISOString();
    await db.query('INSERT IGNORE INTO event_seeds (id, seeded_at) VALUES ?', [marks.map((id) => [id, now])]);
  }
  return fresh.length;
}
