import path from 'node:path';
import { config } from '../config.js';
import { readSeedAnnouncements, syncAnnouncementSeed } from './announcementsTable.js';
import { importLegacyData, mediaDirFor, storageDirFor } from './legacyImport.js';
import { closePool, ensureSchema, getPool } from './mysql.js';

let ready;

/**
 * Start-up for the MySQL store, in order: create tables → import old files (so their "already
 * seeded" list is known) → merge new seed announcements. If the database is unreachable the
 * next request tries again, so the app recovers without a restart.
 */
export function databaseReady() {
  ready ??= (async () => {
    const db = getPool();
    await ensureSchema(db);
    const legacy = config.legacyImportDirs;
    await importLegacyData(db, {
      storageDirs: [config.paths.storage, ...legacy.map(storageDirFor)],
      mediaDirs: [path.join(config.paths.media, 'announcements'), ...legacy.map(mediaDirFor)],
    });
    await syncAnnouncementSeed(db, await readSeedAnnouncements());
    return db;
  })().catch((error) => {
    ready = undefined;
    console.error('[parbon] database is not available:', error.message);
    throw error;
  });
  return ready;
}

export async function closeDatabase() {
  ready = undefined;
  await closePool();
}
