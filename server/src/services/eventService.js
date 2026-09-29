import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { databaseReady } from '../db/index.js';
import { eventsTable, readSeedEvents } from '../db/eventsTable.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Website events, managed in Admin → Events. With a database they live in MySQL; otherwise in
 * STORAGE_DIR/events.json. server/data/events.json is the seed: each entry is merged in once, so new
 * seed events reach a live site after a deploy and an event an admin deletes stays deleted.
 *
 * Upcoming / past is worked out from the dates in India time; events without a date are "planned"
 * (date to be announced). Public lists are sorted: upcoming soonest first, then planned, then past
 * most recent first.
 */
const storeFile = () => path.join(config.paths.storage, 'events.json');

let queue = Promise.resolve();
const exclusive = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

// ── File store (no database) ──
let seeded = [];

async function readStore() {
  const file = storeFile();
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8'));
}

async function saveFile(events) {
  const file = storeFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ events, seeded }, null, 2), 'utf8');
  await rename(tmp, file);
}

async function syncFileSeed() {
  await mkdir(config.paths.storage, { recursive: true });
  const store = await readStore();
  const events = store?.events || [];
  seeded = store?.seeded || [];
  const fresh = (await readSeedEvents()).filter((e) => e.id && !seeded.includes(e.id));
  if (!store || fresh.length) {
    seeded = [...seeded, ...fresh.map((e) => e.id)];
    await saveFile([...events, ...fresh.filter((e) => !events.some((x) => x.id === e.id || x.slug === e.slug))]);
  }
}

let ready;
const init = () => {
  ready ??= syncFileSeed().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
};

async function loadFile() {
  await init();
  return (await readStore())?.events || [];
}

const fileStore = {
  list: loadFile,
  async insert(record) {
    await saveFile([...(await loadFile()), record]);
  },
  async update(record) {
    await saveFile((await loadFile()).map((e) => (e.id === record.id ? record : e)));
  },
  async remove(id) {
    const list = await loadFile();
    const next = list.filter((e) => e.id !== id);
    if (next.length === list.length) return false;
    await saveFile(next);
    return true;
  },
};

const mysqlStore = {
  list: async () => eventsTable.all(await databaseReady()),
  insert: async (record) => eventsTable.insert(await databaseReady(), record),
  update: async (record) => eventsTable.update(await databaseReady(), record),
  remove: async (id) => eventsTable.remove(await databaseReady(), id),
};

const store = () => (config.db.enabled ? mysqlStore : fileStore);
const load = () => store().list();

/** Public pages fall back to the seed if the database is briefly unreachable. */
async function loadPublic() {
  try {
    return await load();
  } catch (error) {
    if (!config.db.enabled) throw error;
    return readSeedEvents();
  }
}

// ── Timing & ordering (India Standard Time, no daylight saving) ──
const IST = '+05:30';
const startMoment = (e) => Date.parse(`${e.startDate}T${e.startTime || '00:00'}:00${IST}`);
const endMoment = (e) => Date.parse(`${e.endDate || e.startDate}T${e.endTime || '23:59'}:59${IST}`);

/** "upcoming" (including happening now), "past", or "planned" (date to be announced). */
export function eventTiming(e, now = Date.now()) {
  if (!e.startDate) return 'planned';
  return endMoment(e) < now ? 'past' : 'upcoming';
}

const RANK = { upcoming: 0, planned: 1, past: 2 };
export function sortEvents(list, now = Date.now()) {
  return [...list].sort((a, b) => {
    const ta = eventTiming(a, now);
    const tb = eventTiming(b, now);
    if (ta !== tb) return RANK[ta] - RANK[tb];
    if (ta === 'upcoming') return startMoment(a) - startMoment(b);
    if (ta === 'past') return endMoment(b) - endMoment(a);
    return String(a.title?.en).localeCompare(String(b.title?.en));
  });
}

const isLive = (e, now = Date.now()) => e.state === 'published' && Date.parse(e.publishedAt || 0) <= now;
/** Adds the computed status the public pages use (upcoming / planned / past). */
const withStatus = (e, now) => ({ ...e, status: eventTiming(e, now) });

export function slugify(text) {
  return (
    String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'event'
  );
}

function uniqueSlug(base, list, ignoreId) {
  let slug = base;
  for (let n = 2; list.some((e) => e.slug === slug && e.id !== ignoreId); n += 1) slug = `${base}-${n}`;
  return slug;
}

const summaryOf = ({ schedule: _schedule, description: _description, highlights: _highlights, ...rest }) => ({
  ...rest,
  hasSchedule: Array.isArray(_schedule) && _schedule.length > 0,
});

export const eventService = {
  /** Published events, soonest upcoming first. `summary` drops the heavy fields for list pages. */
  async listPublished({ status, summary = true } = {}) {
    const now = Date.now();
    const items = sortEvents((await loadPublic()).filter((e) => isLive(e, now)), now).map((e) => withStatus(e, now));
    const filtered = status ? items.filter((e) => e.status === status) : items;
    return summary ? filtered.map(summaryOf) : filtered;
  },

  async getPublishedBySlug(slug) {
    const now = Date.now();
    const e = (await loadPublic()).find((x) => x.slug === slug && isLive(x, now));
    return e ? withStatus(e, now) : null;
  },

  async listAll() {
    const now = Date.now();
    return sortEvents(await load(), now).map((e) => withStatus(e, now));
  },

  async getById(id) {
    const e = (await load()).find((x) => x.id === id);
    return e ? withStatus(e, Date.now()) : null;
  },

  create(input, author) {
    return exclusive(async () => {
      const list = await load();
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(),
        ...input,
        slug: uniqueSlug(slugify(input.slug || input.title.en), list),
        publishedAt: input.publishedAt || now,
        createdAt: now,
        updatedAt: now,
        author,
      };
      await store().insert(record);
      return withStatus(record, Date.now());
    });
  },

  /** Once an event has been public, its link name can't change (shared links and pages use it). */
  update(id, input) {
    return exclusive(async () => {
      const list = await load();
      const current = list.find((e) => e.id === id);
      if (!current) return null;
      const slug = slugify(input.slug || current.slug);
      if (slug !== current.slug) {
        if (current.state === 'published') {
          throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', {
            slug: 'This event is already published, so its link name can’t change.',
          });
        }
        if (list.some((e) => e.slug === slug && e.id !== id)) {
          throw new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', { slug: 'Another event already uses this link name.' });
        }
      }
      const record = {
        ...current,
        ...input,
        slug,
        id,
        // Publishing a draft for the first time stamps "now" unless a time was chosen.
        publishedAt: input.publishedAt || (input.state === 'published' && current.state !== 'published' ? new Date().toISOString() : current.publishedAt),
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      delete record.status;
      await store().update(record);
      return withStatus(record, Date.now());
    });
  },

  remove(id) {
    return exclusive(() => store().remove(id));
  },
};
