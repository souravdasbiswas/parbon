import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Announcements are created by admins at runtime, so they live in STORAGE_DIR
 * (never overwritten by a code redeploy). On first run the store is seeded from
 * server/data/announcements.seed.json. Swap this module for a database later —
 * the routes only use the exported functions.
 */
const storeFile = () => path.join(config.paths.storage, 'announcements.json');
const seedFile = () => path.join(config.paths.data, 'announcements.seed.json');

let queue = Promise.resolve();
/** Serialises writes so concurrent admin requests can't clobber each other. */
const exclusive = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

async function load() {
  const file = storeFile();
  if (!existsSync(file)) {
    await mkdir(config.paths.storage, { recursive: true });
    if (existsSync(seedFile())) await copyFile(seedFile(), file);
    else await writeFile(file, JSON.stringify({ announcements: [] }, null, 2), 'utf8');
  }
  const { announcements = [] } = JSON.parse(await readFile(file, 'utf8'));
  return announcements;
}

async function save(announcements) {
  const file = storeFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ announcements }, null, 2), 'utf8');
  await rename(tmp, file); // atomic replace
}

const sortForDisplay = (a, b) =>
  Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.publishedAt).localeCompare(String(a.publishedAt));

const isLive = (a, now = Date.now()) => a.status === 'published' && new Date(a.publishedAt).getTime() <= now;

export function slugify(text) {
  return (
    String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'announcement'
  );
}

function uniqueSlug(base, list, ignoreId) {
  let slug = base;
  for (let n = 2; list.some((a) => a.slug === slug && a.id !== ignoreId); n += 1) slug = `${base}-${n}`;
  return slug;
}

export const announcementService = {
  async listPublished({ limit } = {}) {
    const items = (await load()).filter((a) => isLive(a)).sort(sortForDisplay);
    return limit ? items.slice(0, limit) : items;
  },

  async getPublishedBySlug(slug) {
    return (await load()).find((a) => a.slug === slug && isLive(a)) || null;
  },

  async listAll() {
    return (await load()).sort(sortForDisplay);
  },

  async getById(id) {
    return (await load()).find((a) => a.id === id) || null;
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
      list.push(record);
      await save(list);
      return record;
    });
  },

  update(id, input) {
    return exclusive(async () => {
      const list = await load();
      const index = list.findIndex((a) => a.id === id);
      if (index === -1) return null;
      const current = list[index];
      const slug = uniqueSlug(slugify(input.slug || current.slug || input.title.en), list, id);
      list[index] = { ...current, ...input, slug, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
      await save(list);
      return list[index];
    });
  },

  remove(id) {
    return exclusive(async () => {
      const list = await load();
      const next = list.filter((a) => a.id !== id);
      if (next.length === list.length) return false;
      await save(next);
      return true;
    });
  },
};
