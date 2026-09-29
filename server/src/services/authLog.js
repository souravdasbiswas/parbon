/**
 * One log line per sign-in attempt, for the host's logs (Hostinger → Node.js → Logs):
 *   [parbon][auth] admin sign-in FAILED reason=wrong_password user=admin ip=203.0.113.7
 * Passwords, PINs, hashes, tokens and secret values are never passed in. A username that
 * doesn't belong to an account is masked, because people sometimes type a password there.
 */

/** Keeps a logged value on one line and short, so input can't forge extra log lines. */
const safe = (value, max = 80) =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F\u2028\u2029\s]+/g, '_')
    .slice(0, max);

/** "somebody" → "so***(8)"; short names show one character. */
export function maskUsername(value) {
  const text = String(value ?? '');
  if (!text) return '(empty)';
  const shown = text.length >= 6 ? 2 : 1;
  return `${safe(text.slice(0, shown), 2)}***(${text.length})`;
}

/**
 * For lines anyone can trigger without limit (blocked or rate-limited requests): one line per
 * key per minute, so the log can't be flooded. The next line reports how many were skipped.
 */
const throttled = new Map();
const THROTTLE_MS = 60_000;
function throttle(key, now = Date.now()) {
  if (throttled.size > 5000) throttled.clear();
  const t = throttled.get(key);
  if (t && now - t.at < THROTTLE_MS) {
    t.skipped += 1;
    return null;
  }
  throttled.set(key, { at: now, skipped: 0 });
  return { skipped: t?.skipped || 0 };
}

/**
 * @param {object} entry
 * @param {'admin'|'gate'} entry.who
 * @param {boolean} entry.ok
 * @param {string} [entry.reason]    why it failed (e.g. wrong_password, not_configured)
 * @param {string} [entry.username]  as typed
 * @param {boolean} [entry.knownUser] true when the username belongs to an account (shown in full)
 * @param {string} [entry.ip]
 * @param {Record<string, string|number>} [entry.details] extra key=value pairs (no secrets)
 * @param {boolean} [entry.throttle] at most one line per reason + IP per minute
 */
export function logSignIn({ who, ok, reason, username, knownUser = false, ip, details = {}, throttle: limit = false }) {
  let skipped = 0;
  if (limit) {
    const t = throttle(`${who}:${reason}:${ip}`);
    if (!t) return null;
    skipped = t.skipped;
  }
  const parts = [`[parbon][auth] ${who} sign-in ${ok ? 'OK' : 'FAILED'}`];
  if (!ok && reason) parts.push(`reason=${safe(reason, 40)}`);
  if (username !== undefined) parts.push(`user=${knownUser ? safe(username, 40) : maskUsername(username)}`);
  if (ip) parts.push(`ip=${safe(ip, 64)}`);
  for (const [k, v] of Object.entries(details)) if (v !== undefined && v !== '') parts.push(`${safe(k, 20)}=${safe(v, 200)}`);
  if (skipped) parts.push(`repeated=${skipped}_more_in_the_last_minute`);
  const line = parts.join(' ');
  (ok ? console.log : console.warn)(line);
  return line;
}

/** For tests. */
export const resetSignInLogThrottle = () => throttled.clear();
