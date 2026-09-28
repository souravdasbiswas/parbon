import mysql from 'mysql2/promise';
import { config } from '../config.js';

/**
 * MySQL/MariaDB connection pool and schema. Tables are created on first use, so a fresh
 * Hostinger database needs no manual setup. Values that were JSON in the file store are kept as
 * JSON text (LONGTEXT) so this works on both MySQL and MariaDB.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    slug VARCHAR(191) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    published_at VARCHAR(32) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    data LONGTEXT NOT NULL,
    UNIQUE KEY uq_announcements_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // Seed entries already merged once — so an entry an admin deletes stays deleted.
  `CREATE TABLE IF NOT EXISTS announcement_seeds (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    seeded_at VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS inquiries (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    created_at VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(191) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(40) NULL,
    message TEXT NOT NULL,
    ip VARCHAR(64) NULL,
    user_agent VARCHAR(400) NULL,
    source VARCHAR(16) NOT NULL DEFAULT 'form',
    KEY idx_inquiries_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS media (
    name VARCHAR(191) NOT NULL PRIMARY KEY,
    mime VARCHAR(64) NOT NULL,
    size INT UNSIGNED NOT NULL,
    bytes MEDIUMBLOB NOT NULL,
    created_at VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // Legacy files already imported (by content hash), so they are not imported again.
  `CREATE TABLE IF NOT EXISTS data_imports (
    source VARCHAR(191) NOT NULL PRIMARY KEY,
    rows_imported INT UNSIGNED NOT NULL,
    imported_at VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

let pool;

export function getPool() {
  pool ??= mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
    enableKeepAlive: true,
    connectTimeout: 10_000,
  });
  return pool;
}

/** Creates any missing tables. Safe to run on every start. */
export async function ensureSchema(db) {
  for (const sql of SCHEMA) await db.query(sql);
}

export async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
