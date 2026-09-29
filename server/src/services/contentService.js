import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Content repository backed by JSON files in server/data.
 *
 * Every piece of content uses language-aware fields ({ en, bn }). The service is the
 * only place that knows content lives in files — swapping to a database or headless
 * CMS later only requires a new repository with the same method signatures.
 */
export class JsonContentRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
  }

  async read(name) {
    const file = path.join(this.dataDir, `${name}.json`);
    const { mtimeMs } = await stat(file);
    const cached = this.cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.value;
    const value = JSON.parse(await readFile(file, 'utf8'));
    this.cache.set(file, { mtimeMs, value });
    return value;
  }
}

// Events are managed in the admin now (see eventService); server/data/events.json is only their seed.
export function createContentService(repository) {
  return {
    getSite: () => repository.read('site'),
    getGallery: () => repository.read('gallery'),
    getCommittee: () => repository.read('committee'),
    getSupport: () => repository.read('support'),
  };
}

export const contentService = createContentService(new JsonContentRepository(config.paths.data));
