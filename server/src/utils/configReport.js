/**
 * Start-up diagnostics: which settings reached this process and whether each feature is on.
 * Only setting NAMES, counts and yes/no checks are reported — never a value — so the result is
 * safe to print to the host's logs.
 */
import { PROJECT_ROOT, config, envFiles } from '../config.js';

/** Every setting the app reads (see .env.example). */
export const KNOWN_SETTINGS = Object.freeze([
  'NODE_ENV', 'PORT', 'SITE_URL', 'CORS_ORIGINS', 'TRUST_PROXY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO',
  'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'SESSION_HOURS', 'SCANNER_SESSION_HOURS',
  'DATA_DIR', 'STORAGE_DIR', 'MEDIA_DIR', 'LEGACY_IMPORT_DIRS',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
]);

/** Settings a live Parbon site is expected to have. */
export const EXPECTED_SETTINGS = Object.freeze([
  'SITE_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET',
  'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM',
]);

const SCRYPT_HASH_RE = /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/;
const normaliseName = (name) => name.trim().toUpperCase().replace(/[\s.-]+/g, '_');
const isSet = (env, name) => typeof env[name] === 'string' && env[name] !== '';

/** Problems with a value that would silently break sign-in (checked without revealing the value). */
function valueProblems(env) {
  const problems = [];
  for (const name of KNOWN_SETTINGS) {
    const v = env[name];
    if (typeof v !== 'string' || v === '') continue;
    if (v !== v.trim()) problems.push(`${name} has spaces at the start or end`);
    if (/^(['"]).*\1$/s.test(v.trim())) problems.push(`${name} is wrapped in quotes`);
  }
  if (isSet(env, 'SESSION_SECRET') && env.SESSION_SECRET.length < 32) problems.push(`SESSION_SECRET is too short (${env.SESSION_SECRET.length} < 32 characters)`);
  if (isSet(env, 'ADMIN_PASSWORD_HASH') && !SCRYPT_HASH_RE.test(env.ADMIN_PASSWORD_HASH.trim().replace(/^(['"])(.*)\1$/s, '$2'))) {
    problems.push('ADMIN_PASSWORD_HASH is not a hash from `npm run admin:hash` (it should start with scrypt$ and have 6 parts)');
  }
  return problems;
}

/** Why admin sign-in is off (setting names / problems), or [] when it is available. */
export function adminProblems(env = process.env) {
  const missing = ['ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'].filter((n) => !isSet(env, n)).map((n) => `${n} missing`);
  const short = isSet(env, 'SESSION_SECRET') && env.SESSION_SECRET.length < 32 ? [`SESSION_SECRET too short`] : [];
  return [...missing, ...short];
}

export function configReport(env = process.env) {
  const names = Object.keys(env);
  const known = new Set(KNOWN_SETTINGS);
  const nearMisses = names
    .filter((n) => !known.has(n) && known.has(normaliseName(n)))
    .map((n) => ({ name: JSON.stringify(n), looksLike: normaliseName(n) }));
  const npmNames = names.filter((n) => /^npm_/i.test(n)).length;
  const siteUrl = env.SITE_URL || '';
  return {
    node: process.version,
    nodeEnv: config.nodeEnv,
    pid: process.pid,
    cwd: process.cwd(),
    appRoot: PROJECT_ROOT,
    envFiles,
    totalVariables: names.length,
    otherVariables: names.filter((n) => !known.has(n) && !/^npm_/i.test(n)).sort(),
    npmVariables: npmNames,
    present: KNOWN_SETTINGS.filter((n) => isSet(env, n)),
    empty: KNOWN_SETTINGS.filter((n) => env[n] === ''),
    missing: EXPECTED_SETTINGS.filter((n) => !isSet(env, n)),
    nearMisses,
    problems: valueProblems(env),
    features: {
      admin: adminProblems(env),
      storage: isSet(env, 'DB_NAME') && isSet(env, 'DB_USER') ? 'mysql' : 'file',
      email: isSet(env, 'SMTP_HOST') ? 'on' : 'off',
      siteUrl: !siteUrl ? 'not set (localhost)' : /localhost|127\.0\.0\.1/.test(siteUrl) ? 'localhost' : 'set',
    },
  };
}

/** The report as log lines, each starting with `[parbon][config]`. */
export function configReportLines(report = configReport()) {
  const list = (items) => (items.length ? items.join(', ') : 'none');
  const files = report.envFiles
    .map((f) => `${f.file}=${f.status}${f.status === 'loaded' ? `(${f.keys} keys, ${f.applied} used)` : f.error ? `(${f.error})` : ''}`)
    .join('  ');
  const f = report.features;
  const others = report.otherVariables;
  const shownOthers = others.length > 40 ? `${others.slice(0, 40).join(', ')} … (+${others.length - 40} more)` : list(others);
  const lines = [
    `node=${report.node} env=${report.nodeEnv} pid=${report.pid}`,
    `cwd=${report.cwd} appRoot=${report.appRoot}`,
    `.env files: ${files}`,
    `variables in this process: ${report.totalVariables} (npm_*: ${report.npmVariables}; others not used by Parbon: ${shownOthers})`,
    `settings present: ${list(report.present)}`,
    `settings missing: ${list(report.missing)}${report.empty.length ? `  (set but empty: ${report.empty.join(', ')})` : ''}`,
    `admin sign-in=${f.admin.length ? `OFF (${f.admin.join(', ')})` : 'ON'}  storage=${f.storage}  email=${f.email.toUpperCase()}  site_url=${f.siteUrl}`,
  ];
  if (report.nearMisses.length) lines.push(`names that look like Parbon settings but don't match exactly: ${report.nearMisses.map((m) => `${m.name}→${m.looksLike}`).join(', ')}`);
  if (report.problems.length) lines.push(`problems: ${report.problems.join('; ')}`);
  return lines.map((l) => `[parbon][config] ${l}`);
}
