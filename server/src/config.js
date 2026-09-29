import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const homeDir = () => {
  try {
    return os.homedir();
  } catch {
    return '';
  }
};

/**
 * Where settings files are looked for, in order:
 * 1. the app folder;
 * 2. the working folder, when it differs (some hosts write `.env` there);
 * 3. `parbon.env` in the account's home folder. Hosting deploys replace the app folder but never
 *    touch the home folder, so settings kept there survive every deploy even if the host fails to
 *    pass its own environment variables to the app.
 */
export const HOME_ENV_FILE = homeDir() ? path.join(homeDir(), 'parbon.env') : '';
export const ENV_FILE_CANDIDATES = Object.freeze([path.join(PROJECT_ROOT, '.env'), path.resolve(process.cwd(), '.env'), HOME_ENV_FILE].filter(Boolean));

/**
 * Loads the settings files that exist. Variables already set by the host (e.g. Hostinger hPanel)
 * take precedence, and an earlier file wins over a later one — except that the home-folder file
 * also fills settings the host passed EMPTY (an empty value is never valid for Parbon's settings).
 * Returns what happened to each file — names and counts only — for the start-up diagnostics.
 */
export function loadEnvFiles(files = ENV_FILE_CANDIDATES, target = process.env, { fillEmptyFrom = HOME_ENV_FILE } = {}) {
  return [...new Set(files)].map((file) => {
    if (!existsSync(file)) return { file, status: 'absent' };
    try {
      const parsed = parseEnv(readFileSync(file, 'utf8'));
      const keys = Object.keys(parsed);
      const fillEmpty = file === fillEmptyFrom;
      const applied = keys.filter((k) => target[k] === undefined || (fillEmpty && target[k] === '' && parsed[k] !== ''));
      for (const k of applied) target[k] = parsed[k];
      // The file holds secrets: on Linux it should be readable by this account only (chmod 600).
      const shared = process.platform !== 'win32' && (statSync(file).mode & 0o077) !== 0;
      return { file, status: 'loaded', keys: keys.length, applied: applied.length, ...(shared && { warning: 'readable by other accounts (chmod 600)' }) };
    } catch (error) {
      return { file, status: 'unreadable', error: error.code || error.name };
    }
  });
}

export const envFiles = loadEnvFiles();

const env = process.env;
const bool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
const list = (value) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const nodeEnv = env.NODE_ENV || 'development';

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(env.PORT) || 5000,
  siteUrl: (env.SITE_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  corsOrigins: list(env.CORS_ORIGINS),
  trustProxy: bool(env.TRUST_PROXY, true),
  paths: {
    data: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(SERVER_ROOT, 'data'),
    storage: env.STORAGE_DIR ? path.resolve(env.STORAGE_DIR) : path.join(SERVER_ROOT, 'storage'),
    media: env.MEDIA_DIR ? path.resolve(env.MEDIA_DIR) : path.join(SERVER_ROOT, 'media'),
    clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
  },
  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 465,
    secure: bool(env.SMTP_SECURE, true),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Parbon Sanskritik Samity <no-reply@localhost>',
    to: env.MAIL_TO || '',
  },
  admin: {
    username: env.ADMIN_USERNAME || '',
    // scrypt hash produced by `npm run admin:hash` — the plain password is never stored.
    passwordHash: env.ADMIN_PASSWORD_HASH || '',
    sessionSecret: env.SESSION_SECRET || '',
    sessionHours: Number(env.SESSION_HOURS) || 8,
  },
  // How long a gate volunteer stays signed in to the coupon scanner.
  scanner: {
    sessionHours: Number(env.SCANNER_SESSION_HOURS) || 16,
  },
  // MySQL/MariaDB (e.g. Hostinger hPanel → Databases). When DB_NAME and DB_USER are set,
  // announcements, form responses and uploaded images live in the database; otherwise in files.
  // The host defaults to 127.0.0.1 (not "localhost", which Node may resolve to IPv6 ::1).
  db: {
    enabled: Boolean(env.DB_NAME && env.DB_USER),
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    name: env.DB_NAME || '',
    user: env.DB_USER || '',
    password: env.DB_PASSWORD || '',
  },
  // Old storage folders (e.g. previous Hostinger deployments) to import once into the database.
  legacyImportDirs: list(env.LEGACY_IMPORT_DIRS).map((dir) => path.resolve(dir)),
});
