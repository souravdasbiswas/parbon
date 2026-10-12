import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { databaseReady } from '../db/index.js';
import { readSeedSponsors, sponsorsTable } from '../db/sponsorsTable.js';

/**
 * Sponsors are managed by admins at runtime (Admin → Sponsors). With a database configured they live
 * in MySQL, which survives redeploys; otherwise in STORAGE_DIR/sponsors.json. Entries in
 * server/data/sponsors.seed.json are merged in once each, and one an admin deletes stays deleted.
 */
const storeFile = () => path.join(config.paths.storage, 'sponsors.json');

let queue = Promise.resolve();
/** Serialises writes so concurrent admin requests can't clobber each other. */
const exclusive = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

// ── File store ──
let seeded = [];

async function readStore() {
  const file = storeFile();
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8'));
}

async function saveFile(sponsors) {
  const file = storeFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ sponsors, seeded }, null, 2), 'utf8');
  await rename(tmp, file); // atomic replace
}

async function syncSeed() {
  await mkdir(config.paths.storage, { recursive: true });
  const store = await readStore();
  const sponsors = store?.sponsors || [];
  seeded = store?.seeded || [];
  const fresh = (await readSeedSponsors()).filter((s) => s.id && !seeded.includes(s.id));
  if (!store || fresh.length) {
    seeded = [...seeded, ...fresh.map((s) => s.id)];
    await saveFile([...sponsors, ...fresh]);
  }
}

let ready;
const init = () => {
  ready ??= syncSeed().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
};

async function loadFile() {
  await init();
  return (await readStore())?.sponsors || [];
}

const fileStore = {
  list: loadFile,
  async insert(record) {
    await saveFile([...(await loadFile()), record]);
  },
  async updateMany(records) {
    const byId = new Map(records.map((r) => [r.id, r]));
    await saveFile((await loadFile()).map((s) => byId.get(s.id) || s));
  },
  async remove(id) {
    const list = await loadFile();
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length) return false;
    await saveFile(next);
    return true;
  },
};

// ── MySQL store ──
const mysqlStore = {
  list: async () => sponsorsTable.all(await databaseReady()),
  insert: async (record) => sponsorsTable.insert(await databaseReady(), record),
  async updateMany(records) {
    const db = await databaseReady();
    for (const record of records) await sponsorsTable.update(db, record);
  },
  remove: async (id) => sponsorsTable.remove(await databaseReady(), id),
};

const store = config.db.enabled ? mysqlStore : fileStore;

const byOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
const load = async () => (await store.list()).sort(byOrder);

/** Public pages fall back to the shipped sponsors if the database is briefly unreachable. */
async function loadPublic() {
  try {
    return await load();
  } catch (error) {
    if (!config.db.enabled) throw error;
    return (await readSeedSponsors()).sort(byOrder);
  }
}

/** What visitors see: only what the page needs, never admin bookkeeping. */
const toPublic = ({ id, name, url, logo, tile }) => ({ id, name, url, logo, tile: Boolean(tile) });

export const sponsorService = {
  async listPublished() {
    return (await loadPublic()).filter((s) => s.status !== 'hidden').map(toPublic);
  },

  listAll: load,

  async getById(id) {
    return (await load()).find((s) => s.id === id) || null;
  },

  create(input, author) {
    return exclusive(async () => {
      const list = await load();
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(),
        ...input,
        sortOrder: Math.max(0, ...list.map((s) => Number(s.sortOrder) || 0)) + 1,
        createdAt: now,
        updatedAt: now,
        author,
      };
      await store.insert(record);
      return record;
    });
  },

  update(id, input) {
    return exclusive(async () => {
      const current = (await load()).find((s) => s.id === id);
      if (!current) return null;
      const record = { ...current, ...input, id, sortOrder: current.sortOrder, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
      await store.updateMany([record]);
      return record;
    });
  },

  /** Puts the sponsors in the order of `ids`; any not listed keep their relative order after them. */
  reorder(ids) {
    return exclusive(async () => {
      const list = await load();
      const rank = new Map(ids.map((id, i) => [id, i]));
      const before = new Map(list.map((s) => [s.id, s.sortOrder]));
      const next = [...list]
        .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
        .map((s, i) => ({ ...s, sortOrder: i + 1 }));
      const changed = next.filter((s) => s.sortOrder !== before.get(s.id));
      if (changed.length) await store.updateMany(changed);
      return next;
    });
  },

  remove(id) {
    return exclusive(() => store.remove(id));
  },
};
