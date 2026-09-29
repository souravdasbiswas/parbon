import path from 'node:path';
import { PROJECT_ROOT, config } from '../config.js';
import { readSeedAnnouncements, syncAnnouncementSeed } from './announcementsTable.js';
import { readSeedEvents, syncEventSeed } from './eventsTable.js';
import { findPreviousDeployments, importLegacyData, mediaDirFor, storageDirFor } from './legacyImport.js';
import { closePool, ensureSchema, getPool } from './mysql.js';

let ready;

/** Folders whose old files are imported: this app, LEGACY_IMPORT_DIRS, and earlier Hostinger deployments. */
export async function legacySources() {
  const previous = await findPreviousDeployments(PROJECT_ROOT);
  const roots = [...config.legacyImportDirs, ...previous];
  return {
    previous,
    storageDirs: [config.paths.storage, ...roots.map(storageDirFor)].filter(Boolean),
    mediaDirs: [path.join(config.paths.media, 'announcements'), ...roots.map(mediaDirFor)].filter(Boolean),
  };
}

/**
 * Start-up for the MySQL store, in order: create tables → import old files (so their "already
 * seeded" list is known) → merge new seed announcements. If the database is unreachable the
 * next request tries again, so the app recovers without a restart.
 */
export function databaseReady() {
  ready ??= (async () => {
    const db = getPool();
    await ensureSchema(db);
    const sources = await legacySources();
    if (sources.previous.length) console.log(`[parbon] checking ${sources.previous.length} earlier deployment folder(s) for data to import`);
    await importLegacyData(db, sources);
    await syncAnnouncementSeed(db, await readSeedAnnouncements());
    await syncEventSeed(db, await readSeedEvents());
    scheduleFollowUpImports(db, sources);
    return db;
  })().catch((error) => {
    ready = undefined;
    console.error(
      `[parbon][config] database connection FAILED code=${error.code || error.name} host=${config.db.host}:${config.db.port} database=${config.db.name} user=${config.db.user}: ${error.message}`,
    );
    throw error;
  });
  return ready;
}

// During a deploy the previous version keeps serving for a short while, so a form submitted
// there lands in its folder after this version's first import. Look again a little later.
// (LEGACY_FOLLOW_UP_MS, comma-separated milliseconds, overrides the delays — used in rehearsals.)
const FOLLOW_UP_MS = process.env.LEGACY_FOLLOW_UP_MS
  ? process.env.LEGACY_FOLLOW_UP_MS.split(',').map(Number).filter((n) => n > 0)
  : [2 * 60_000, 10 * 60_000];
let followUpsScheduled = false;

function scheduleFollowUpImports(db, sources) {
  if (followUpsScheduled || !sources.previous.length) return;
  followUpsScheduled = true;
  for (const ms of FOLLOW_UP_MS) {
    setTimeout(() => {
      importLegacyData(db, { ...sources, announcements: false }).catch((error) =>
        console.error('[parbon] follow-up import failed:', error.message),
      );
    }, ms).unref();
  }
}

/** For the admin storage page: what's in the database and what was imported from where. */
export async function storageReport() {
  const db = await databaseReady();
  const counts = {};
  for (const table of ['announcements', 'site_events', 'inquiries', 'media', 'coupon_events', 'coupon_registrations', 'coupons', 'gate_users']) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[table] = Number(row.n);
  }
  const [imports] = await db.query('SELECT source, rows_imported, imported_at FROM data_imports ORDER BY imported_at DESC LIMIT 50');
  const sources = await legacySources();
  return {
    database: { name: config.db.name, host: config.db.host, port: config.db.port },
    counts,
    previousDeployments: sources.previous,
    imports: imports.map((r) => ({
      kind: r.source.split(':')[0],
      rows: Number(r.rows_imported),
      importedAt: r.imported_at,
    })),
  };
}

/** Resolves "connected" or "unavailable" within `ms`, for the health check. */
export async function databaseStatus(ms = 3000) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve('unavailable'), ms);
  });
  const check = databaseReady()
    .then((db) => db.query('SELECT 1'))
    .then(
      () => 'connected',
      () => 'unavailable',
    );
  const status = await Promise.race([check, timeout]);
  clearTimeout(timer);
  return status;
}

export async function closeDatabase() {
  ready = undefined;
  await closePool();
}
