/**
 * One-time (safe to repeat) import of the old file storage into MySQL.
 *
 * The app already does this automatically on every start, including checking earlier Hostinger
 * deployment folders. Use this script when the old files are somewhere else, e.g. downloaded from
 * hPanel File Manager to your computer.
 *
 *   npm run db:migrate -- --dry-run --from ./backup          # only show what the files contain
 *   npm run db:migrate -- --from ./backup                    # import into the database in DB_* settings
 *
 * `--from` may point at an app folder (containing server/storage and server/media), a `server`
 * folder, or a storage folder with announcements.json / inquiries.ndjson (images in announcements/).
 * Repeat `--from` for several folders. Without `--from`, the same folders as the app are used.
 * Old files are only read. Rows already in the database are never overwritten or duplicated.
 */
import path from 'node:path';
import { config } from '../server/src/config.js';
import { readSeedAnnouncements, syncAnnouncementSeed } from '../server/src/db/announcementsTable.js';
import { legacySources } from '../server/src/db/index.js';
import { importLegacyData, mediaDirFor, scanLegacyData, storageDirFor } from '../server/src/db/legacyImport.js';
import { closePool, ensureSchema, getPool } from '../server/src/db/mysql.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const from = args.flatMap((arg, i) => (arg === '--from' && args[i + 1] ? [path.resolve(args[i + 1])] : []));

const sources = from.length
  ? { storageDirs: from.map(storageDirFor).filter(Boolean), mediaDirs: from.map(mediaDirFor).filter(Boolean) }
  : await legacySources();

console.log('Folders to read:');
for (const dir of new Set([...sources.storageDirs, ...sources.mediaDirs])) console.log(`  ${dir}`);

if (dryRun) {
  const found = await scanLegacyData(sources);
  if (!found.length) console.log('\nNo announcements.json, inquiries.ndjson or images found.');
  else {
    console.log('\nFound (nothing is written in a dry run):');
    for (const f of found) console.log(`  ${String(f.rows).padStart(5)}  ${f.file}${f.modified ? `  (modified ${f.modified})` : ''}`);
    console.log('\nAll announcements.json snapshots (newest first), inquiries.ndjson files and images are merged.');
  }
  process.exit(0);
}

if (!config.db.enabled) {
  console.error('\nSet DB_NAME, DB_USER and DB_PASSWORD (and DB_HOST if not 127.0.0.1) in .env or the shell first.');
  process.exit(1);
}

const db = getPool();
try {
  console.log(`\nDatabase: "${config.db.name}" on ${config.db.host}:${config.db.port}`);
  await ensureSchema(db);
  const totals = await importLegacyData(db, sources);
  const seeded = await syncAnnouncementSeed(db, await readSeedAnnouncements());
  console.log(
    `\nImported ${totals.announcements} announcements, ${totals.inquiries} form responses, ${totals.images} images` +
      (seeded ? ` (+${seeded} new seed announcements)` : ''),
  );
  console.log('Now in the database:');
  for (const table of ['announcements', 'inquiries', 'media']) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`  ${table.padEnd(14)} ${row.n}`);
  }
} catch (error) {
  console.error('\nMigration failed:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
