import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { databaseReady } from '../db/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { FREE_EVENT_PRICE_ERROR, takesPayments } from '../utils/validateCoupons.js';

/**
 * Coupons for events: admins define events and coupon types (entry pass, food coupon…), people
 * register and get one coupon per type with a quantity ("Entry pass ×4"), and gate volunteers
 * check them in. Everything lives in MySQL; issuing locks the event row so coupons can't be oversold.
 */
export const couponsEnabled = () => config.db.enabled;

async function db() {
  if (!couponsEnabled()) {
    throw new HttpError(503, 'COUPONS_DISABLED', 'Coupons need the database, which is not configured on this server.');
  }
  return databaseReady();
}

const now = () => new Date().toISOString();
const invalid = (fields, message = 'Please check the highlighted fields.') => new HttpError(422, 'VALIDATION_FAILED', message, fields);

// ── Codes & links ──

// No 0/O, 1/I/L or U, so codes are easy to read out and type at the gate.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;
export const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
export const normaliseCode = (input) => String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const newToken = () => randomBytes(16).toString('base64url');
const TOKEN_RE = /^[\w-]{22}$/;
export const couponUrl = (token) => `${config.siteUrl}/c/${token}`;

/** Accepts what a scanner reads or a volunteer types: a coupon link, a bare token, or the printed code. */
export function parseScanInput(input) {
  const text = String(input || '').trim();
  const fromUrl = text.match(/\/c\/([\w-]{22})(?:[/?#]|$)/);
  if (fromUrl) return { token: fromUrl[1] };
  if (TOKEN_RE.test(text)) return { token: text };
  const code = normaliseCode(text);
  if (code.length === CODE_LENGTH) return { code };
  return null;
}

// ── Row mapping ──

const parse = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
};

function eventFromRow(r) {
  return {
    ...parse(r.data),
    id: r.id,
    slug: r.slug,
    status: r.status,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const typeFromRow = (r) => ({ design: null, ...parse(r.data), id: r.id, eventId: r.event_id, sortOrder: r.sort_order });
const byOrder = (a, b) => a.sortOrder - b.sortOrder || String(a.name?.en).localeCompare(String(b.name?.en));

function registrationFromRow(r) {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    attendees: r.attendees,
    paymentMethod: r.payment_method,
    txnRef: r.txn_ref || '',
    amountDue: r.amount_due,
    paymentStatus: r.payment_status,
    adminNote: r.admin_note || '',
    source: r.source,
    emailSentAt: r.email_sent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function couponFromRow(r) {
  return {
    id: r.id,
    eventId: r.event_id,
    registrationId: r.registration_id,
    typeId: r.type_id,
    code: formatCode(r.code),
    token: r.token,
    url: couponUrl(r.token),
    quantity: r.quantity,
    usedCount: r.used_count,
    remaining: Math.max(0, r.quantity - r.used_count),
    status: r.status,
    replaces: r.replaces,
    replacedBy: r.replaced_by,
    cancelReason: r.cancel_reason || '',
    issuedAt: r.issued_at,
    cancelledAt: r.cancelled_at,
  };
}

// ── Event timing ──

export const linksExpireAt = (event) => event.linksExpireAt || event.endsAt;
export const isExpired = (event, at = now()) => at >= linksExpireAt(event);
export function registrationState(event, at = now()) {
  if (event.status === 'draft') return 'draft';
  if (event.status === 'closed') return 'closed';
  if (isExpired(event, at) || at >= event.endsAt) return 'over';
  if (event.registrationClosesAt && at >= event.registrationClosesAt) return 'closed';
  return 'open';
}

// ── Loading helpers ──

async function loadEvent(conn, where, value, { lock = false } = {}) {
  const [rows] = await conn.query(`SELECT * FROM coupon_events WHERE ${where} = ?${lock ? ' FOR UPDATE' : ''}`, [value]);
  return rows[0] ? eventFromRow(rows[0]) : null;
}

async function loadTypes(conn, eventId) {
  const [rows] = await conn.query('SELECT * FROM coupon_types WHERE event_id = ?', [eventId]);
  return rows.map(typeFromRow).sort(byOrder);
}

/** Active (not cancelled or replaced) quantity per coupon type, and checked-in counts. */
async function usage(conn, eventId) {
  const [rows] = await conn.query(
    `SELECT type_id, status, COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(used_count), 0) AS used, COUNT(*) AS n
       FROM coupons WHERE event_id = ? GROUP BY type_id, status`,
    [eventId],
  );
  const byType = {};
  let issued = 0;
  let checkedIn = 0;
  for (const r of rows) {
    const t = (byType[r.type_id] ??= { issued: 0, checkedIn: 0, coupons: 0, cancelled: 0 });
    if (r.status === 'active') {
      t.issued += Number(r.qty);
      t.coupons += Number(r.n);
      issued += Number(r.qty);
    }
    if (r.status === 'cancelled') t.cancelled += Number(r.qty);
    // Reissued coupons carry their check-ins over, so the replaced originals aren't counted twice.
    if (r.status !== 'replaced') {
      t.checkedIn += Number(r.used);
      checkedIn += Number(r.used);
    }
  }
  return { byType, issued, checkedIn };
}

async function withTransaction(fn) {
  const pool = await db();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

async function insertCoupon(conn, fields) {
  // Codes and tokens are random; on the (astronomically unlikely) clash, draw again.
  for (let attempt = 0; ; attempt += 1) {
    const coupon = { id: randomUUID(), code: newCode(), token: newToken(), ...fields };
    try {
      await conn.query(
        `INSERT INTO coupons (id, event_id, registration_id, type_id, code, token, quantity, used_count, status, replaces, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [coupon.id, coupon.eventId, coupon.registrationId, coupon.typeId, coupon.code, coupon.token, coupon.quantity, coupon.usedCount || 0, coupon.replaces || null, coupon.issuedAt],
      );
      return coupon;
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY' || attempt >= 4) throw error;
    }
  }
}

// ── Public ──

const publicType = (t, used) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  kind: t.kind,
  price: t.price,
  maxPerRegistration: t.maxPerRegistration,
  remaining: t.quota ? Math.max(0, t.quota - (used?.issued || 0)) : null,
});

function publicEvent(event, types, use) {
  const totalRemaining = Math.max(0, event.totalQuota - use.issued);
  return {
    slug: event.slug,
    title: event.title,
    tagline: event.tagline,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationClosesAt: event.registrationClosesAt,
    venue: event.venue,
    contact: event.contact,
    maxAttendees: event.maxAttendees,
    payment: event.payment,
    linkedEventSlug: event.linkedEventSlug,
    registration: registrationState(event),
    remaining: totalRemaining,
    types: types
      .filter((t) => t.active)
      .map((t) => {
        const pt = publicType(t, use.byType[t.id]);
        pt.remaining = pt.remaining === null ? totalRemaining : Math.min(pt.remaining, totalRemaining);
        return pt;
      }),
  };
}

export const couponService = {
  /** Open events for the public list and site-event links; [] when coupons are off. */
  async listOpenEvents({ linkedEventSlug } = {}) {
    if (!couponsEnabled()) return [];
    const pool = await db();
    const [rows] = await pool.query("SELECT * FROM coupon_events WHERE status = 'open' ORDER BY starts_at");
    const events = rows.map(eventFromRow).filter((e) => registrationState(e) === 'open');
    return events
      .filter((e) => !linkedEventSlug || e.linkedEventSlug === linkedEventSlug)
      .map((e) => ({ slug: e.slug, title: e.title, tagline: e.tagline, startsAt: e.startsAt, endsAt: e.endsAt, venue: e.venue, linkedEventSlug: e.linkedEventSlug }));
  },

  async getPublicEvent(slug) {
    const pool = await db();
    const event = await loadEvent(pool, 'slug', slug);
    if (!event || event.status === 'draft') return null;
    return publicEvent(event, await loadTypes(pool, event.id), await usage(pool, event.id));
  },

  /**
   * Issues coupons for a registration. Web registrations must respect the registration window,
   * attendee and per-type limits; admins (walk-ins at the counter) may register until links expire.
   */
  async register(eventRef, value, { admin = false, ip, userAgent, markPaid = false } = {}) {
    return withTransaction(async (conn) => {
      const event = await loadEvent(conn, admin ? 'id' : 'slug', eventRef, { lock: true });
      if (!event || (!admin && event.status === 'draft')) throw new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found.');
      const state = registrationState(event);
      if (!admin && state !== 'open') {
        throw new HttpError(409, 'REGISTRATION_CLOSED', state === 'over' ? 'This event is over.' : 'Registrations for this event are closed.');
      }
      if (admin && isExpired(event)) throw new HttpError(409, 'EVENT_OVER', 'This event is over — its coupon links have expired.');
      if (!admin && value.attendees > event.maxAttendees) {
        throw invalid({ attendees: `Up to ${event.maxAttendees} people per registration.` });
      }

      const types = new Map((await loadTypes(conn, event.id)).map((t) => [t.id, t]));
      const use = await usage(conn, event.id);
      const fields = {};
      let requested = 0;
      let amount = 0;
      for (const item of value.items) {
        const type = types.get(item.typeId);
        if (!type || !type.active) {
          fields[`items.${item.typeId}`] = 'This coupon is no longer available.';
          continue;
        }
        if (item.quantity > type.maxPerRegistration && !admin) {
          fields[`items.${item.typeId}`] = `Up to ${type.maxPerRegistration} per registration.`;
        }
        const left = type.quota ? type.quota - (use.byType[type.id]?.issued || 0) : Infinity;
        if (item.quantity > left) {
          fields[`items.${item.typeId}`] = left > 0 ? `Only ${left} left.` : 'Sold out.';
        }
        requested += item.quantity;
        amount += item.quantity * type.price;
      }
      if (Object.keys(fields).length) throw invalid(fields);
      const totalLeft = event.totalQuota - use.issued;
      if (requested > totalLeft) {
        throw new HttpError(409, 'SOLD_OUT', totalLeft > 0 ? `Only ${totalLeft} coupons are left for this event.` : 'All coupons for this event have been issued.', {
          items: totalLeft > 0 ? `Only ${totalLeft} left in total.` : 'Sold out.',
        });
      }

      let paymentMethod = value.paymentMethod;
      let paymentStatus;
      if (amount === 0) {
        paymentMethod = 'free';
        paymentStatus = 'free';
      } else if (markPaid) {
        paymentStatus = 'paid';
      } else if (paymentMethod === 'txn' && (admin || event.payment?.allowTxn !== false)) {
        paymentStatus = 'to_verify';
      } else if (paymentMethod === 'pledge' && (admin || event.payment?.allowPledge !== false)) {
        paymentStatus = 'pledged';
      } else if (!admin && !takesPayments(event.payment)) {
        throw invalid({ paymentMethod: 'These coupons have a price, but this event isn’t taking payments online. Please contact the organisers.' });
      } else {
        throw invalid({ paymentMethod: 'Please choose one of the payment options shown.' });
      }

      const at = now();
      const registration = {
        id: randomUUID(),
        eventId: event.id,
        name: value.name,
        email: value.email,
        phone: value.phone,
        attendees: value.attendees,
        paymentMethod,
        txnRef: paymentMethod === 'txn' ? value.txnRef : '',
        amountDue: amount,
        paymentStatus,
        source: admin ? 'admin' : 'web',
        createdAt: at,
      };
      await conn.query(
        `INSERT INTO coupon_registrations
           (id, event_id, name, email, phone, attendees, payment_method, txn_ref, amount_due, payment_status, source, ip, user_agent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          registration.id, event.id, registration.name, registration.email, registration.phone, registration.attendees,
          paymentMethod, registration.txnRef || null, amount, paymentStatus, registration.source,
          ip ? String(ip).slice(0, 64) : null, userAgent ? String(userAgent).slice(0, 400) : null, at, at,
        ],
      );
      const coupons = [];
      for (const item of value.items) {
        const coupon = await insertCoupon(conn, { eventId: event.id, registrationId: registration.id, typeId: item.typeId, quantity: item.quantity, issuedAt: at });
        coupons.push({ ...coupon, code: formatCode(coupon.code), url: couponUrl(coupon.token), type: types.get(item.typeId) });
      }
      return { event, registration, coupons };
    });
  },

  /** A coupon for its public page. Expired events answer 410 so old links stop working. */
  async getCouponByToken(token) {
    if (!TOKEN_RE.test(String(token || ''))) return null;
    const pool = await db();
    const [rows] = await pool.query(
      `SELECT c.*, r.name, r.payment_status, r.amount_due
         FROM coupons c JOIN coupon_registrations r ON r.id = c.registration_id WHERE c.token = ?`,
      [token],
    );
    if (!rows[0]) return null;
    const coupon = couponFromRow(rows[0]);
    const event = await loadEvent(pool, 'id', coupon.eventId);
    if (!event) return null;
    if (isExpired(event)) {
      throw new HttpError(410, 'COUPON_EXPIRED', 'This event is over, so its coupons are no longer available.', undefined);
    }
    const [[typeRow]] = await pool.query('SELECT * FROM coupon_types WHERE id = ?', [coupon.typeId]);
    const type = typeRow ? typeFromRow(typeRow) : { name: { en: 'Coupon', bn: '' }, kind: 'other', price: 0, design: null };
    const live = coupon.status === 'active';
    return {
      status: coupon.status,
      code: live ? coupon.code : null,
      url: live ? coupon.url : null,
      token: live ? coupon.token : null,
      quantity: coupon.quantity,
      usedCount: coupon.usedCount,
      remaining: coupon.remaining,
      holder: rows[0].name,
      paymentStatus: rows[0].payment_status,
      amountDue: rows[0].amount_due,
      issuedAt: coupon.issuedAt,
      type: { name: type.name, kind: type.kind, price: type.price, design: live ? type.design : null },
      event: {
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        linksExpireAt: linksExpireAt(event),
        venue: event.venue,
        contact: event.contact,
      },
    };
  },

  // ── Admin: events ──

  async listEvents() {
    const pool = await db();
    const [rows] = await pool.query('SELECT * FROM coupon_events ORDER BY starts_at DESC');
    const [regs] = await pool.query('SELECT event_id, COUNT(*) AS n FROM coupon_registrations GROUP BY event_id');
    const regCount = Object.fromEntries(regs.map((r) => [r.event_id, Number(r.n)]));
    const events = [];
    for (const event of rows.map(eventFromRow)) {
      const use = await usage(pool, event.id);
      events.push({ ...event, registration: registrationState(event), stats: { issued: use.issued, checkedIn: use.checkedIn, registrations: regCount[event.id] || 0 } });
    }
    return events;
  },

  async getEvent(id) {
    const pool = await db();
    const event = await loadEvent(pool, 'id', id);
    if (!event) return null;
    const types = await loadTypes(pool, id);
    const use = await usage(pool, id);
    const [payments] = await pool.query(
      'SELECT payment_status, COUNT(*) AS n, COALESCE(SUM(amount_due), 0) AS amount FROM coupon_registrations WHERE event_id = ? GROUP BY payment_status',
      [id],
    );
    return {
      ...event,
      registration: registrationState(event),
      types: types.map((t) => ({ ...t, stats: use.byType[t.id] || { issued: 0, checkedIn: 0, coupons: 0, cancelled: 0 } })),
      stats: {
        issued: use.issued,
        checkedIn: use.checkedIn,
        remaining: Math.max(0, event.totalQuota - use.issued),
        payments: Object.fromEntries(payments.map((p) => [p.payment_status, { count: Number(p.n), amount: Number(p.amount) }])),
      },
    };
  },

  /**
   * Creates the event and (optionally) its first coupon types in one transaction — either all of
   * it is saved or none of it, so a failed attempt never leaves a half-made event behind.
   */
  async createEvent(value, types = []) {
    const at = now();
    const id = randomUUID();
    const { slug, status, startsAt, endsAt, ...data } = value;
    if (!takesPayments(value.payment)) {
      const priced = Object.fromEntries(types.map((t, i) => [i, t]).filter(([, t]) => t.price > 0).map(([i]) => [`types.${i}.price`, FREE_EVENT_PRICE_ERROR]));
      if (Object.keys(priced).length) throw invalid(priced);
    }
    await withTransaction(async (conn) => {
      try {
        await conn.query(
          'INSERT INTO coupon_events (id, slug, status, starts_at, ends_at, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, slug, status, startsAt, endsAt, at, at, JSON.stringify(data)],
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw invalid({ slug: 'Another coupon event already uses this link name. Choose another one, or open that event from Coupons.' });
        throw error;
      }
      for (const [index, type] of types.entries()) {
        const { sortOrder, ...typeData } = type;
        await conn.query('INSERT INTO coupon_types (id, event_id, sort_order, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)', [
          randomUUID(), id, sortOrder || index, at, at, JSON.stringify({ design: null, ...typeData }),
        ]);
      }
    });
    return this.getEvent(id);
  },

  async updateEvent(id, value) {
    await withTransaction(async (conn) => {
      const current = await loadEvent(conn, 'id', id, { lock: true });
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
      const use = await usage(conn, id);
      if (value.totalQuota < use.issued) throw invalid({ totalQuota: `${use.issued} coupons are already issued — the limit can't be lower.` });
      if (!takesPayments(value.payment)) {
        // Turning payments off makes the event free: no coupon on sale may still have a price.
        const [rows] = await conn.query('SELECT * FROM coupon_types WHERE event_id = ?', [id]);
        const priced = rows.map(typeFromRow).filter((t) => t.active !== false && t.price > 0);
        if (priced.length) {
          throw invalid({
            'payment.allowPledge': `Some coupons still have a price (${priced.map((t) => `${t.name?.en} ₹${t.price}`).join(', ')}). Make them free (₹0) in “Coupon types & designs” first, or keep a way to pay ticked.`,
          });
        }
      }
      const { slug, status, startsAt, endsAt, ...data } = value;
      try {
        await conn.query(
          'UPDATE coupon_events SET slug = ?, status = ?, starts_at = ?, ends_at = ?, updated_at = ?, data = ? WHERE id = ?',
          [slug, status, startsAt, endsAt, now(), JSON.stringify(data), id],
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw invalid({ slug: 'Another coupon event already uses this link name. Choose another one, or open that event from Coupons.' });
        throw error;
      }
    });
    return this.getEvent(id);
  },

  /** Only events nobody registered for can be deleted; others should be closed instead. */
  async deleteEvent(id) {
    return withTransaction(async (conn) => {
      const event = await loadEvent(conn, 'id', id, { lock: true });
      if (!event) return false;
      const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM coupon_registrations WHERE event_id = ?', [id]);
      if (Number(n) > 0) throw new HttpError(409, 'EVENT_HAS_REGISTRATIONS', 'People have registered for this event. Close it instead of deleting it.');
      await conn.query('DELETE FROM coupon_types WHERE event_id = ?', [id]);
      await conn.query('DELETE FROM coupon_events WHERE id = ?', [id]);
      return true;
    });
  },

  // ── Admin: coupon types ──

  async createType(eventId, value) {
    const pool = await db();
    const event = await loadEvent(pool, 'id', eventId);
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
    if (value.price > 0 && value.active !== false && !takesPayments(event.payment)) throw invalid({ price: FREE_EVENT_PRICE_ERROR });
    const at = now();
    const id = randomUUID();
    const { sortOrder, ...data } = value;
    await pool.query('INSERT INTO coupon_types (id, event_id, sort_order, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)', [
      id, eventId, sortOrder, at, at, JSON.stringify({ design: null, ...data }),
    ]);
    return this.getType(id);
  },

  async getType(id) {
    const pool = await db();
    const [[row]] = await pool.query('SELECT * FROM coupon_types WHERE id = ?', [id]);
    return row ? typeFromRow(row) : null;
  },

  async updateType(id, value) {
    await withTransaction(async (conn) => {
      const [[row]] = await conn.query('SELECT * FROM coupon_types WHERE id = ? FOR UPDATE', [id]);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Coupon type not found.');
      const current = typeFromRow(row);
      if (value.price > 0 && value.active !== false) {
        const event = await loadEvent(conn, 'id', current.eventId);
        if (event && !takesPayments(event.payment)) throw invalid({ price: FREE_EVENT_PRICE_ERROR });
      }
      const issued = (await usage(conn, current.eventId)).byType[id]?.issued || 0;
      if (value.quota && value.quota < issued) throw invalid({ quota: `${issued} are already issued — the limit can't be lower.` });
      const { sortOrder, ...data } = value;
      const design = data.design === undefined ? current.design : data.design;
      await conn.query('UPDATE coupon_types SET sort_order = ?, updated_at = ?, data = ? WHERE id = ?', [
        sortOrder, now(), JSON.stringify({ ...data, design }), id,
      ]);
    });
    return this.getType(id);
  },

  async saveDesign(id, design) {
    const pool = await db();
    const current = await this.getType(id);
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Coupon type not found.');
    const data = { ...current, design };
    for (const key of ['id', 'eventId', 'sortOrder']) delete data[key];
    await pool.query('UPDATE coupon_types SET updated_at = ?, data = ? WHERE id = ?', [now(), JSON.stringify(data), id]);
    return this.getType(id);
  },

  async deleteType(id) {
    const pool = await db();
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM coupons WHERE type_id = ?', [id]);
    if (Number(n) > 0) throw new HttpError(409, 'TYPE_IN_USE', 'Coupons of this type have been issued. Hide it instead (untick “Available”).');
    const [result] = await pool.query('DELETE FROM coupon_types WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  // ── Admin: registrations & coupons ──

  async listRegistrations(eventId) {
    const pool = await db();
    const [regRows] = await pool.query('SELECT * FROM coupon_registrations WHERE event_id = ? ORDER BY created_at DESC', [eventId]);
    const [couponRows] = await pool.query('SELECT * FROM coupons WHERE event_id = ? ORDER BY issued_at', [eventId]);
    const types = new Map((await loadTypes(pool, eventId)).map((t) => [t.id, t]));
    const byReg = new Map();
    for (const c of couponRows.map(couponFromRow)) {
      const type = types.get(c.typeId);
      c.typeName = type?.name || { en: 'Coupon', bn: '' };
      c.kind = type?.kind || 'other';
      if (!byReg.has(c.registrationId)) byReg.set(c.registrationId, []);
      byReg.get(c.registrationId).push(c);
    }
    return regRows.map((r) => {
      const registration = registrationFromRow(r);
      const coupons = byReg.get(registration.id) || [];
      return { ...registration, coupons, attendance: attendanceOf(coupons) };
    });
  },

  async getRegistration(id) {
    const pool = await db();
    const [[row]] = await pool.query('SELECT * FROM coupon_registrations WHERE id = ?', [id]);
    if (!row) return null;
    const registration = registrationFromRow(row);
    const [couponRows] = await pool.query('SELECT * FROM coupons WHERE registration_id = ? ORDER BY issued_at', [id]);
    const types = new Map((await loadTypes(pool, registration.eventId)).map((t) => [t.id, t]));
    const coupons = couponRows.map(couponFromRow).map((c) => ({ ...c, typeName: types.get(c.typeId)?.name, kind: types.get(c.typeId)?.kind, type: types.get(c.typeId) }));
    return { ...registration, coupons, attendance: attendanceOf(coupons) };
  },

  async updatePayment(id, { status, note }, by = 'admin') {
    const pool = await db();
    const [[row]] = await pool.query('SELECT admin_note FROM coupon_registrations WHERE id = ?', [id]);
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Registration not found.');
    const stamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${by}: payment ${status.replace('_', ' ')}${note ? ` — ${note}` : ''}`;
    const log = [row.admin_note, stamp].filter(Boolean).join('\n').slice(-500);
    await pool.query('UPDATE coupon_registrations SET payment_status = ?, admin_note = ?, updated_at = ? WHERE id = ?', [status, log, now(), id]);
    return this.getRegistration(id);
  },

  async markEmailed(id) {
    const pool = await db();
    await pool.query('UPDATE coupon_registrations SET email_sent_at = ? WHERE id = ?', [now(), id]);
  },

  async cancelCoupon(id, reason = '') {
    const pool = await db();
    const [result] = await pool.query(
      "UPDATE coupons SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE id = ? AND status = 'active'",
      [now(), String(reason).slice(0, 300) || null, id],
    );
    if (!result.affectedRows) throw new HttpError(409, 'NOT_ACTIVE', 'Only active coupons can be cancelled.');
    return this.getCoupon(id);
  },

  async cancelRegistration(id, reason = '') {
    const pool = await db();
    await pool.query(
      "UPDATE coupons SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE registration_id = ? AND status = 'active'",
      [now(), String(reason).slice(0, 300) || null, id],
    );
    return this.getRegistration(id);
  },

  /**
   * Replaces a coupon with a new code and link (e.g. the old link was shared by mistake), or brings a
   * cancelled one back. The old link stops working at once; check-ins so far carry over.
   */
  async reissueCoupon(id) {
    const newId = await withTransaction(async (conn) => {
      const [[row]] = await conn.query('SELECT * FROM coupons WHERE id = ?', [id]);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Coupon not found.');
      const event = await loadEvent(conn, 'id', row.event_id, { lock: true });
      const [[old]] = await conn.query('SELECT * FROM coupons WHERE id = ? FOR UPDATE', [id]);
      if (old.status === 'replaced') throw new HttpError(409, 'ALREADY_REPLACED', 'This coupon was already reissued — use the newer one.');
      if (isExpired(event)) throw new HttpError(409, 'EVENT_OVER', 'This event is over.');
      if (old.status === 'cancelled') {
        const use = await usage(conn, event.id);
        const [[typeRow]] = await conn.query('SELECT * FROM coupon_types WHERE id = ?', [old.type_id]);
        const type = typeRow ? typeFromRow(typeRow) : null;
        const typeLeft = type?.quota ? type.quota - (use.byType[old.type_id]?.issued || 0) : Infinity;
        if (old.quantity > typeLeft || old.quantity > event.totalQuota - use.issued) {
          throw new HttpError(409, 'SOLD_OUT', 'Not enough coupons left to bring this one back.');
        }
      }
      const coupon = await insertCoupon(conn, {
        eventId: old.event_id,
        registrationId: old.registration_id,
        typeId: old.type_id,
        quantity: old.quantity,
        usedCount: old.used_count,
        replaces: old.id,
        issuedAt: now(),
      });
      await conn.query("UPDATE coupons SET status = 'replaced', replaced_by = ?, cancelled_at = COALESCE(cancelled_at, ?) WHERE id = ?", [coupon.id, now(), old.id]);
      return coupon.id;
    });
    return this.getCoupon(newId);
  },

  async getCoupon(id) {
    const pool = await db();
    const [[row]] = await pool.query('SELECT * FROM coupons WHERE id = ?', [id]);
    return row ? couponFromRow(row) : null;
  },

  // ── Scanner ──

  async scannerEvents() {
    const pool = await db();
    const [rows] = await pool.query("SELECT * FROM coupon_events WHERE status <> 'draft' ORDER BY starts_at");
    return rows
      .map(eventFromRow)
      .filter((e) => !isExpired(e))
      .map((e) => ({ id: e.id, slug: e.slug, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt }));
  },

  async scannerStats(eventId) {
    const pool = await db();
    const event = await loadEvent(pool, 'id', eventId);
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Event not found.');
    const use = await usage(pool, eventId);
    return { issued: use.issued, checkedIn: use.checkedIn };
  },

  /** Finds a coupon from a scan or typed code and says whether it can be let in. */
  async lookup(eventId, input) {
    const parsed = parseScanInput(input);
    if (!parsed) throw new HttpError(422, 'UNREADABLE', 'That is not a coupon code. Codes look like ABCD-2345.');
    const pool = await db();
    const [rows] = await pool.query(
      `SELECT c.*, r.name, r.phone, r.attendees, r.payment_status, r.payment_method, r.txn_ref, r.amount_due
         FROM coupons c JOIN coupon_registrations r ON r.id = c.registration_id
        WHERE ${parsed.token ? 'c.token' : 'c.code'} = ?`,
      [parsed.token || parsed.code],
    );
    if (!rows[0]) throw new HttpError(404, 'COUPON_NOT_FOUND', 'No coupon matches this code.');
    return describeForGate(pool, rows[0], eventId);
  },

  async checkIn(eventId, couponId, count, by) {
    const couponRow = await withTransaction(async (conn) => {
      const [[row]] = await conn.query('SELECT * FROM coupons WHERE id = ? FOR UPDATE', [couponId]);
      if (!row) throw new HttpError(404, 'COUPON_NOT_FOUND', 'Coupon not found.');
      if (row.event_id !== eventId) throw new HttpError(409, 'WRONG_EVENT', 'This coupon is for a different event.');
      if (row.status !== 'active') throw new HttpError(409, 'NOT_ACTIVE', row.status === 'replaced' ? 'This coupon was replaced by a newer one.' : 'This coupon was cancelled.');
      const event = await loadEvent(conn, 'id', row.event_id);
      if (isExpired(event)) throw new HttpError(409, 'EVENT_OVER', 'This event is over.');
      const remaining = row.quantity - row.used_count;
      if (remaining <= 0) throw new HttpError(409, 'FULLY_USED', 'Everyone on this coupon is already in.');
      if (count > remaining) throw new HttpError(409, 'TOO_MANY', `Only ${remaining} more can be let in on this coupon.`);
      await conn.query('UPDATE coupons SET used_count = used_count + ? WHERE id = ?', [count, couponId]);
      await conn.query('INSERT INTO coupon_checkins (id, coupon_id, event_id, count, scanned_by, scanned_at) VALUES (?, ?, ?, ?, ?, ?)', [
        randomUUID(), couponId, row.event_id, count, String(by).slice(0, 40), now(),
      ]);
      return row;
    });
    return this.lookup(eventId, couponRow.token);
  },

  async undoCheckIn(eventId, checkinId) {
    const token = await withTransaction(async (conn) => {
      const [[checkin]] = await conn.query('SELECT * FROM coupon_checkins WHERE id = ? FOR UPDATE', [checkinId]);
      if (!checkin || checkin.event_id !== eventId) throw new HttpError(404, 'NOT_FOUND', 'Check-in not found.');
      if (checkin.undone_at) throw new HttpError(409, 'ALREADY_UNDONE', 'This check-in was already undone.');
      const [[coupon]] = await conn.query('SELECT * FROM coupons WHERE id = ? FOR UPDATE', [checkin.coupon_id]);
      if (coupon.status === 'replaced') throw new HttpError(409, 'NOT_ACTIVE', 'This coupon was reissued; undo on the new coupon instead.');
      await conn.query('UPDATE coupons SET used_count = GREATEST(used_count - ?, 0) WHERE id = ?', [checkin.count, coupon.id]);
      await conn.query('UPDATE coupon_checkins SET undone_at = ? WHERE id = ?', [now(), checkinId]);
      return coupon.token;
    });
    return this.lookup(eventId, token);
  },

  async markPaidAtGate(eventId, couponId, by) {
    const pool = await db();
    const [[row]] = await pool.query('SELECT registration_id, token, event_id FROM coupons WHERE id = ?', [couponId]);
    if (!row || row.event_id !== eventId) throw new HttpError(404, 'COUPON_NOT_FOUND', 'Coupon not found.');
    await this.updatePayment(row.registration_id, { status: 'paid', note: 'collected at the gate' }, by);
    return this.lookup(eventId, row.token);
  },
};

/** "in" when everyone on the entry coupons has been let in, "partial", "none", or "cancelled". */
export function attendanceOf(coupons) {
  const live = coupons.filter((c) => c.status === 'active');
  if (!live.length) return coupons.some((c) => c.status === 'cancelled') ? 'cancelled' : 'none';
  const entry = live.filter((c) => c.kind === 'entry');
  const counted = entry.length ? entry : live;
  const qty = counted.reduce((s, c) => s + c.quantity, 0);
  const used = counted.reduce((s, c) => s + c.usedCount, 0);
  if (used <= 0) return 'none';
  return used >= qty ? 'in' : 'partial';
}

async function describeForGate(pool, row, eventId) {
  const coupon = couponFromRow(row);
  const event = await loadEvent(pool, 'id', coupon.eventId);
  const [[typeRow]] = await pool.query('SELECT * FROM coupon_types WHERE id = ?', [coupon.typeId]);
  const type = typeRow ? typeFromRow(typeRow) : { name: { en: 'Coupon' }, kind: 'other', price: 0 };
  const [checkins] = await pool.query(
    'SELECT id, count, scanned_by, scanned_at, undone_at FROM coupon_checkins WHERE coupon_id = ? ORDER BY scanned_at DESC LIMIT 10',
    [coupon.id],
  );

  let verdict = 'ok';
  let message = 'Valid coupon';
  if (coupon.eventId !== eventId) {
    verdict = 'wrong_event';
    message = `This coupon is for ${event?.title?.en || 'another event'}.`;
  } else if (event && isExpired(event)) {
    verdict = 'expired';
    message = 'This event is over.';
  } else if (coupon.status === 'cancelled') {
    verdict = 'cancelled';
    message = `Cancelled${coupon.cancelReason ? ` — ${coupon.cancelReason}` : ''}.`;
  } else if (coupon.status === 'replaced') {
    verdict = 'replaced';
    message = 'This coupon was replaced by a newer one. Ask for the latest link.';
  } else if (coupon.remaining <= 0) {
    verdict = 'used';
    message = 'Everyone on this coupon is already in.';
  } else if (coupon.usedCount > 0) {
    message = `${coupon.usedCount} of ${coupon.quantity} already in.`;
  }

  return {
    verdict,
    message,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      quantity: coupon.quantity,
      usedCount: coupon.usedCount,
      remaining: coupon.remaining,
      status: coupon.status,
      type: { name: type.name, kind: type.kind, price: type.price },
    },
    registration: {
      id: coupon.registrationId,
      name: row.name,
      phone: row.phone,
      attendees: row.attendees,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      txnRef: row.txn_ref || '',
      amountDue: row.amount_due,
    },
    event: event ? { id: event.id, title: event.title } : null,
    checkins: checkins.map((c) => ({ id: c.id, count: c.count, by: c.scanned_by, at: c.scanned_at, undone: Boolean(c.undone_at) })),
  };
}
