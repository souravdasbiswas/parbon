import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { INQUIRY_TYPES } from './inquiryService.js';

/**
 * Read-only view of the contact-form submissions that inquiryService appends to
 * STORAGE_DIR/inquiries.ndjson. This module only ever reads that file.
 */
const responsesFile = () => path.join(config.paths.storage, 'inquiries.ndjson');

export const SORT_KEYS = Object.freeze(['createdAt', 'type', 'name', 'email', 'phone', 'ip']);

let cache = null;

const str = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

function toResponse(record, index) {
  const type = str(record.type) || 'general';
  return {
    id: str(record.id) || `line-${index + 1}`,
    createdAt: str(record.createdAt),
    type,
    typeLabel: INQUIRY_TYPES[type] || type,
    name: str(record.name),
    email: str(record.email),
    phone: str(record.phone),
    message: str(record.message),
    ip: str(record.meta?.ip),
    userAgent: str(record.meta?.userAgent),
  };
}

/** Parses the file, skipping blank or damaged lines. Cached until the file changes. */
export async function readResponses() {
  const file = responsesFile();
  let info;
  try {
    info = await stat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return { items: [], skipped: 0 };
    throw error;
  }
  if (cache && cache.file === file && cache.mtimeMs === info.mtimeMs && cache.size === info.size) return cache.value;

  const items = [];
  let skipped = 0;
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const record = JSON.parse(line);
      if (record && typeof record === 'object' && !Array.isArray(record)) items.push(toResponse(record, index));
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  });

  const value = { items, skipped };
  cache = { file, mtimeMs: info.mtimeMs, size: info.size, value };
  return value;
}

const fold = (text) => text.normalize('NFC').toLocaleLowerCase('en');
const digits = (text) => text.replace(/\D/g, '');

function matches(item, q) {
  const needle = fold(q);
  if ([item.name, item.email, item.phone, item.message, item.id].some((v) => fold(v).includes(needle))) return true;
  // Lets "9876543210" find "+91 98765 43210".
  const n = digits(q);
  return n.length >= 3 && /^[\d\s+()-]+$/.test(q) && digits(item.phone).includes(n);
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const sortValue = (item, key) => (key === 'type' ? item.typeLabel : item[key]);

function compare(key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    // Empty values always go last, whichever direction.
    if (!va !== !vb) return va ? -1 : 1;
    const primary = key === 'createdAt' ? va.localeCompare(vb) : collator.compare(va, vb);
    return sign * primary || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  };
}

/** Normalises query params; unknown values fall back to the defaults (newest first, all types). */
export function parseQuery(query = {}) {
  const sort = SORT_KEYS.includes(query.sort) ? query.sort : 'createdAt';
  const dir = query.dir === 'asc' || query.dir === 'desc' ? query.dir : sort === 'createdAt' ? 'desc' : 'asc';
  const type = typeof query.type === 'string' && Object.hasOwn(INQUIRY_TYPES, query.type) ? query.type : '';
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 200) : '';
  return { sort, dir, type, q };
}

/** Filters and sorts responses. Counts per type reflect the search but not the type filter. */
export async function queryResponses(query) {
  const { sort, dir, type, q } = parseQuery(query);
  const { items: all, skipped } = await readResponses();
  const searched = q ? all.filter((item) => matches(item, q)) : all;
  const counts = Object.fromEntries(Object.keys(INQUIRY_TYPES).map((key) => [key, 0]));
  for (const item of searched) counts[item.type] = (counts[item.type] || 0) + 1;
  // Copy before sorting so the cached list is never reordered in place.
  const items = (type ? searched.filter((item) => item.type === type) : [...searched]).sort(compare(sort, dir));
  const lastReceivedAt = all.reduce((latest, item) => (item.createdAt > latest ? item.createdAt : latest), '') || null;
  return {
    items,
    counts: { all: searched.length, ...counts },
    total: all.length,
    skipped,
    lastReceivedAt,
    query: { sort, dir, type, q },
  };
}
