import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { UI_VERSION_ROUTE_CHUNKS } from '../uiVersions.js';

let manifestPromise;

async function loadManifest() {
  const file = path.join(config.paths.clientDist, '.vite', 'manifest.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function manifest() {
  manifestPromise ??= loadManifest().catch(() => null);
  return manifestPromise;
}

export async function routeChunkPreloadHref(uiVersion) {
  const key = UI_VERSION_ROUTE_CHUNKS[uiVersion];
  if (!key) return null;
  const data = await manifest();
  const file = data?.[key]?.file;
  return file ? `/${file.replace(/^\/+/, '')}` : null;
}
