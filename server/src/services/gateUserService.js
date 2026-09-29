import { randomInt, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { databaseReady } from '../db/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hashPassword, verifyPassword } from './authService.js';

/**
 * Gate volunteers: people the admin allows to use the coupon scanner at the gate with a username
 * and a short PIN. They can never open the admin area. Stored in MySQL (like all coupon data).
 */
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const PIN_RE = /^\d{4,6}$/;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const now = () => new Date().toISOString();
const clean = (value, max) =>
  typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '';
const invalid = (fields) => new HttpError(422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', fields);

async function db() {
  if (!config.db.enabled) throw new HttpError(503, 'COUPONS_DISABLED', 'Gate volunteers need the database, which is not configured on this server.');
  return databaseReady();
}

export const generatePin = (length = 6) => Array.from({ length }, () => randomInt(10)).join('');

export const usernameFromName = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);

/** Validates an admin's create/update payload. PIN is optional on update, and may be left empty to generate one. */
export function validateGateUser(body, { creating = false } = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    name: clean(input.name, 100),
    username: clean(input.username, 40).toLowerCase(),
    canMarkPaid: Boolean(input.canMarkPaid),
    canUndo: Boolean(input.canUndo),
    active: input.active !== false,
    eventIds: Array.isArray(input.eventIds) ? [...new Set(input.eventIds.map((id) => clean(id, 64)).filter(Boolean))].slice(0, 50) : [],
  };
  const pin = clean(input.pin, 10);
  if (value.name.length < 2) errors.name = 'Please enter the volunteer’s name.';
  if (!USERNAME_RE.test(value.username)) errors.username = 'Use 3–30 lowercase letters, numbers, dots or dashes (e.g. rahul or rahul.das).';
  else if (value.username === String(config.admin.username || '').toLowerCase()) errors.username = 'This name is used by the website admin. Choose another.';
  if (pin && !PIN_RE.test(pin)) errors.pin = 'The PIN must be 4 to 6 digits.';
  if (creating) value.pin = pin || generatePin();
  return Object.keys(errors).length ? { errors } : { value };
}

const parseIds = (text) => {
  try {
    const ids = JSON.parse(text || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

function fromRow(r) {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    active: Boolean(r.active),
    canMarkPaid: Boolean(r.can_mark_paid),
    canUndo: Boolean(r.can_undo),
    eventIds: parseIds(r.event_ids),
    sessionVersion: r.session_version,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Wrong-PIN counters per username (memory is fine: a restart only resets the count).
const failures = new Map();
// Compared against when the username doesn't exist, so timing doesn't reveal which names are real.
let dummyHash;

export const gateUserService = {
  async list() {
    const pool = await db();
    const [rows] = await pool.query('SELECT * FROM gate_users ORDER BY name');
    const [counts] = await pool.query(
      'SELECT scanned_by, COALESCE(SUM(count), 0) AS n, MAX(scanned_at) AS last FROM coupon_checkins WHERE undone_at IS NULL GROUP BY scanned_by',
    );
    const byUser = Object.fromEntries(counts.map((c) => [c.scanned_by, { checkIns: Number(c.n), lastCheckInAt: c.last }]));
    return rows.map(fromRow).map((u) => {
      const lock = failures.get(u.username);
      return { ...u, checkIns: byUser[u.username]?.checkIns || 0, lastCheckInAt: byUser[u.username]?.lastCheckInAt || null, locked: Boolean(lock?.until > Date.now()) };
    });
  },

  async get(id) {
    const pool = await db();
    const [[row]] = await pool.query('SELECT * FROM gate_users WHERE id = ?', [id]);
    return row ? fromRow(row) : null;
  },

  async create(value) {
    const pool = await db();
    const at = now();
    const id = randomUUID();
    try {
      await pool.query(
        `INSERT INTO gate_users (id, username, name, pin_hash, active, can_mark_paid, can_undo, event_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, value.username, value.name, await hashPassword(value.pin), value.active ? 1 : 0, value.canMarkPaid ? 1 : 0, value.canUndo ? 1 : 0, JSON.stringify(value.eventIds), at, at],
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw invalid({ username: 'This username is already taken.' });
      throw error;
    }
    return { user: await this.get(id), pin: value.pin };
  },

  /** Disabling or renaming a volunteer ends their current sessions. */
  async update(id, value) {
    const pool = await db();
    const current = await this.get(id);
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Volunteer not found.');
    const endSessions = current.active !== value.active || current.username !== value.username;
    try {
      await pool.query(
        `UPDATE gate_users SET username = ?, name = ?, active = ?, can_mark_paid = ?, can_undo = ?, event_ids = ?, updated_at = ?,
           session_version = session_version + ? WHERE id = ?`,
        [value.username, value.name, value.active ? 1 : 0, value.canMarkPaid ? 1 : 0, value.canUndo ? 1 : 0, JSON.stringify(value.eventIds), now(), endSessions ? 1 : 0, id],
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw invalid({ username: 'This username is already taken.' });
      throw error;
    }
    failures.delete(current.username);
    return this.get(id);
  },

  /** A new PIN (typed by the admin or generated); signs the volunteer out everywhere. */
  async resetPin(id, pin) {
    if (pin && !PIN_RE.test(pin)) throw invalid({ pin: 'The PIN must be 4 to 6 digits.' });
    const pool = await db();
    const user = await this.get(id);
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'Volunteer not found.');
    const next = pin || generatePin();
    await pool.query('UPDATE gate_users SET pin_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?', [await hashPassword(next), now(), id]);
    failures.delete(user.username);
    return { user: await this.get(id), pin: next };
  },

  async remove(id) {
    const pool = await db();
    const [result] = await pool.query('DELETE FROM gate_users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Checks a username + PIN. Five wrong PINs lock that username for 15 minutes. */
  async authenticate(username, pin) {
    const name = clean(username, 40).toLowerCase();
    const lock = failures.get(name);
    if (lock?.until > Date.now()) {
      const minutes = Math.ceil((lock.until - Date.now()) / 60000);
      throw new HttpError(429, 'LOCKED', `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask the admin to reset your PIN.`);
    }
    const pool = await db();
    const [[row]] = await pool.query('SELECT * FROM gate_users WHERE username = ?', [name]);
    dummyHash ??= await hashPassword(generatePin(8));
    const ok = await verifyPassword(String(pin || ''), row ? row.pin_hash : dummyHash);
    if (!row || !ok) {
      const fails = (lock && lock.until > Date.now() ? 0 : lock?.fails || 0) + 1;
      failures.set(name, fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MS } : { fails, until: 0 });
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect username or PIN.');
    }
    failures.delete(name);
    if (!row.active) throw new HttpError(403, 'DISABLED', 'This gate account has been turned off. Please ask the admin.');
    await pool.query('UPDATE gate_users SET last_login_at = ? WHERE id = ?', [now(), row.id]);
    return fromRow(row);
  },

  /** The volunteer behind a session token, if it is still valid (active, and not reset since). */
  async forSession(uid, version) {
    if (!config.db.enabled || !uid) return null;
    const user = await this.get(uid).catch(() => null);
    if (!user || !user.active || user.sessionVersion !== version) return null;
    return user;
  },
};

/** For tests: forget wrong-PIN counters. */
export const resetGateLockouts = () => failures.clear();
