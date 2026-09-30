import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, databaseReady } from './db/index.js';
import { configReportLines } from './utils/configReport.js';

// What this process received from the host (setting names and checks only, never values).
for (const line of configReportLines()) console.log(line);
if (config.uiVersionWarning) console.warn(`[parbon][config] ${config.uiVersionWarning}`);
console.log(`[parbon][config] UI version: ${config.uiVersion} (preview ${config.uiPreview ? 'on' : 'off'})`);

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[parbon] ${config.nodeEnv} server listening on port ${config.port}`);
});

if (config.db.enabled) {
  // Create tables and import any old files now, rather than on the first visitor's request.
  databaseReady().then(
    () => console.log(`[parbon][config] database connection OK: MySQL database "${config.db.name}" on ${config.db.host}:${config.db.port}`),
    () => {}, // already logged; retried on the next request
  );
} else {
  console.log(`[parbon] storage: files in ${config.paths.storage} (set DB_NAME, DB_USER and DB_PASSWORD to use MySQL)`);
}

const shutdown = (signal) => {
  console.log(`[parbon] ${signal} received, shutting down…`);
  server.close(() => closeDatabase().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
