/**
 * Validation for the coupon feature: events, coupon types, coupon designs and registrations.
 * Each validator returns { value } (cleaned) or { errors } (field → message), like validateAnnouncement.
 */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{6,20}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|transparent)$/i;
const UPI_RE = /^[\w.-]{2,64}@[\w.-]{2,64}$/;
// Uploaded images (stored like announcement images) and the bundled logo artwork.
const IMAGE_SRC_RE = /^(\/media\/announcements\/[\w.-]+\.(jpe?g|png|webp)|\/brand\/[\w.-]+\.(png|webp|avif))$/i;

export const EVENT_STATUSES = Object.freeze(['draft', 'open', 'closed']);
export const COUPON_KINDS = Object.freeze(['entry', 'food', 'other']);
export const PAYMENT_METHODS = Object.freeze(['txn', 'pledge', 'free']);
export const PAYMENT_STATUSES = Object.freeze(['to_verify', 'pledged', 'paid', 'rejected', 'free']);

/** An event with neither UPI nor "pay at the counter" ticked is free: all its coupons must cost ₹0. */
export const takesPayments = (payment) => payment?.allowTxn !== false || payment?.allowPledge !== false;
export const FREE_EVENT_PRICE_ERROR = 'This event is free (no way to pay is ticked under Payment), so coupons must cost ₹0. Set the price to 0, or tick a way to pay.';

/** Keep in sync with client/src/components/coupons/designSpec.js. */
export const DESIGN_FONTS = Object.freeze(['display', 'body', 'bengali', 'bengaliSans', 'serif', 'mono']);
export const DESIGN_ICONS = Object.freeze([
  'dhak', 'shankha', 'lotus', 'bhog', 'lamp', 'music', 'book', 'alpana', 'people', 'sindoor', 'calendar', 'pin', 'megaphone', 'check',
]);
export const DESIGN_ELEMENT_TYPES = Object.freeze(['text', 'code', 'qr', 'icon', 'image', 'shape']);
const MAX_ELEMENTS = 60;

const clean = (value, max = 500) =>
  typeof value === 'string'
    ? value
        .normalize('NFC')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\r\n?/g, '\n')
        .trim()
        .slice(0, max)
    : '';
const oneLine = (value, max) => clean(value, max).replace(/\s+/g, ' ');
const localized = (field, max) => ({ en: clean(field?.en, max), bn: clean(field?.bn, max) });
const isHttpUrl = (value) => {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const toIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};
/** Integer within [min, max]; `fallback` when missing; undefined when not a whole number. */
const int = (value, { min, max, fallback = null }) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
};
const num = (value, min, max, fallback) => {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
};
const color = (value, fallback) => (typeof value === 'string' && COLOR_RE.test(value.trim()) ? value.trim().toLowerCase() : fallback);
const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

export const normaliseSlug = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

// ── Events ──

export function validateCouponEvent(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    title: localized(input.title, 140),
    tagline: localized(input.tagline, 200),
    description: localized(input.description, 3000),
    slug: normaliseSlug(input.slug || input.title?.en),
    status: oneOf(input.status, EVENT_STATUSES, 'draft'),
    startsAt: toIso(input.startsAt),
    endsAt: toIso(input.endsAt),
    linksExpireAt: toIso(input.linksExpireAt),
    registrationClosesAt: toIso(input.registrationClosesAt),
    totalQuota: int(input.totalQuota, { min: 1, max: 100000 }),
    maxAttendees: int(input.maxAttendees, { min: 1, max: 100, fallback: 10 }),
    venue: {
      name: oneLine(input.venue?.name, 140),
      address: oneLine(input.venue?.address, 300),
      mapUrl: clean(input.venue?.mapUrl, 500),
    },
    linkedEventSlug: clean(input.linkedEventSlug, 100),
    payment: {
      upiId: clean(input.payment?.upiId, 130),
      payeeName: oneLine(input.payment?.payeeName, 100),
      note: clean(input.payment?.note, 600),
      allowTxn: input.payment?.allowTxn !== false,
      allowPledge: input.payment?.allowPledge !== false,
    },
    contact: {
      name: oneLine(input.contact?.name, 100),
      phone: oneLine(input.contact?.phone, 20),
    },
  };

  if (value.title.en.length < 3) errors['title.en'] = 'Please add the event name (at least 3 characters).';
  if (!value.slug || !SLUG_RE.test(value.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens for the link name.';
  if (!value.startsAt) errors.startsAt = 'Please choose when the event starts.';
  if (!value.endsAt) errors.endsAt = 'Please choose when the event ends.';
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) errors.endsAt = 'The event must end after it starts.';
  if (value.linksExpireAt === undefined) errors.linksExpireAt = 'Please choose a valid date and time.';
  else if (value.linksExpireAt && value.startsAt && value.linksExpireAt <= value.startsAt) {
    errors.linksExpireAt = 'Coupon links must stay valid until after the event starts.';
  }
  if (value.registrationClosesAt === undefined) errors.registrationClosesAt = 'Please choose a valid date and time.';
  if (value.totalQuota === undefined || value.totalQuota === null) errors.totalQuota = 'Enter how many coupons can be issued in total (1 or more).';
  if (value.maxAttendees === undefined) errors.maxAttendees = 'Enter a number between 1 and 100.';
  if (value.venue.mapUrl && !isHttpUrl(value.venue.mapUrl)) errors['venue.mapUrl'] = 'Map link must start with https://';
  if (value.linkedEventSlug && !SLUG_RE.test(value.linkedEventSlug)) errors.linkedEventSlug = 'Choose an event from the list.';
  if (value.payment.allowTxn && value.payment.upiId && !UPI_RE.test(value.payment.upiId)) errors['payment.upiId'] = 'Enter a UPI ID like name@bank.';
  if (value.contact.phone && !PHONE_RE.test(value.contact.phone)) errors['contact.phone'] = 'Please enter a valid phone number.';

  if (!value.linksExpireAt) value.linksExpireAt = value.endsAt;
  if (!value.registrationClosesAt) value.registrationClosesAt = null;
  return Object.keys(errors).length ? { errors } : { value };
}

// ── Coupon types ──

export function validateCouponType(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    name: localized(input.name, 80),
    description: localized(input.description, 300),
    kind: oneOf(input.kind, COUPON_KINDS, 'other'),
    price: int(input.price, { min: 0, max: 1000000, fallback: 0 }),
    quota: int(input.quota, { min: 1, max: 100000 }),
    maxPerRegistration: int(input.maxPerRegistration, { min: 1, max: 100, fallback: 10 }),
    active: input.active !== false,
    sortOrder: int(input.sortOrder, { min: 0, max: 1000, fallback: 0 }) ?? 0,
  };
  if (value.name.en.length < 2) errors['name.en'] = 'Please name this coupon (e.g. Entry pass).';
  if (value.price === undefined) errors.price = 'Enter a whole rupee amount (0 for free).';
  if (value.quota === undefined) errors.quota = 'Enter a number of 1 or more, or leave empty for no separate limit.';
  if (value.maxPerRegistration === undefined) errors.maxPerRegistration = 'Enter a number between 1 and 100.';
  if (input.design !== undefined) {
    const design = validateDesign(input.design);
    if (design.errors) Object.assign(errors, design.errors);
    else value.design = design.value;
  }
  return Object.keys(errors).length ? { errors } : { value };
}

// ── Coupon designs ──

function cleanElement(el, index) {
  const type = el?.type;
  if (!DESIGN_ELEMENT_TYPES.includes(type)) return null;
  const base = {
    id: clean(el.id, 40).replace(/[^\w-]/g, '') || `el${index}`,
    type,
    x: num(el.x, -4000, 8000, 0),
    y: num(el.y, -4000, 8000, 0),
    w: num(el.w, 4, 8000, 100),
    h: num(el.h, 4, 8000, 40),
    rotate: num(el.rotate, -180, 180, 0),
    opacity: num(el.opacity, 0, 1, 1),
    locked: Boolean(el.locked),
    hidden: Boolean(el.hidden),
  };
  const textStyle = () => ({
    font: oneOf(el.font, DESIGN_FONTS, 'body'),
    size: num(el.size, 6, 600, 32),
    weight: oneOf(Number(el.weight), [300, 400, 500, 600, 700, 800, 900], 400),
    italic: Boolean(el.italic),
    uppercase: Boolean(el.uppercase),
    color: color(el.color, '#231a15'),
    align: oneOf(el.align, ['left', 'center', 'right'], 'left'),
    valign: oneOf(el.valign, ['top', 'middle', 'bottom'], 'top'),
    letterSpacing: num(el.letterSpacing, -10, 60, 0),
    lineHeight: num(el.lineHeight, 0.7, 3, 1.2),
    background: color(el.background, 'transparent'),
    radius: num(el.radius, 0, 400, 0),
    padding: num(el.padding, 0, 200, 0),
  });
  switch (type) {
    case 'text':
      return { ...base, text: clean(el.text, 400), ...textStyle() };
    case 'code':
      return { ...base, ...textStyle() };
    case 'qr':
      return {
        ...base,
        h: base.w,
        fg: color(el.fg, '#231a15'),
        bg: color(el.bg, '#ffffff'),
        padding: num(el.padding, 0, 200, 8),
        radius: num(el.radius, 0, 400, 8),
      };
    case 'icon':
      return {
        ...base,
        name: oneOf(el.name, DESIGN_ICONS, 'lotus'),
        color: color(el.color, '#a8201a'),
        strokeWidth: num(el.strokeWidth, 0.5, 4, 1.5),
      };
    case 'image': {
      const src = clean(el.src, 200);
      if (!IMAGE_SRC_RE.test(src)) return null;
      return {
        ...base,
        src,
        fit: oneOf(el.fit, ['cover', 'contain'], 'contain'),
        radius: num(el.radius, 0, 4000, 0),
        blend: oneOf(el.blend, ['normal', 'multiply', 'screen'], 'normal'),
      };
    }
    case 'shape':
      return {
        ...base,
        shape: oneOf(el.shape, ['rect', 'ellipse', 'line'], 'rect'),
        fill: color(el.fill, '#a8201a'),
        stroke: color(el.stroke, 'transparent'),
        strokeWidth: num(el.strokeWidth, 0, 100, 0),
        radius: num(el.radius, 0, 4000, 0),
        dashed: Boolean(el.dashed),
      };
    default:
      return null;
  }
}

export function validateDesign(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const bg = input.background || {};
  const image = bg.image && IMAGE_SRC_RE.test(String(bg.image.src || '')) ? bg.image : null;
  const value = {
    version: 1,
    width: num(input.width, 300, 2400, 1200),
    height: num(input.height, 300, 2400, 600),
    background: {
      color: color(bg.color, '#fbf6ee'),
      gradient: bg.gradient
        ? {
            from: color(bg.gradient.from, '#fbf6ee'),
            to: color(bg.gradient.to, '#efe2c4'),
            angle: num(bg.gradient.angle, 0, 360, 135),
          }
        : null,
      image: image
        ? {
            src: image.src,
            fit: oneOf(image.fit, ['cover', 'contain'], 'cover'),
            opacity: num(image.opacity, 0, 1, 1),
          }
        : null,
    },
    border: {
      color: color(input.border?.color, '#a8201a'),
      width: num(input.border?.width, 0, 60, 0),
      radius: num(input.border?.radius, 0, 300, 24),
    },
    elements: [],
  };
  const elements = Array.isArray(input.elements) ? input.elements : [];
  if (elements.length > MAX_ELEMENTS) errors.design = `A coupon can have at most ${MAX_ELEMENTS} elements.`;
  value.elements = elements.slice(0, MAX_ELEMENTS).map(cleanElement).filter(Boolean);
  const ids = new Set();
  for (const el of value.elements) {
    while (ids.has(el.id)) el.id = `${el.id}x`;
    ids.add(el.id);
  }
  if (!value.elements.some((el) => el.type === 'qr' && !el.hidden)) errors.design = 'The coupon needs a visible QR code so it can be scanned.';
  return Object.keys(errors).length ? { errors } : { value };
}

// ── Registrations ──

/**
 * Checks the shape of a registration. Whether the chosen coupon types exist, have room and fit the
 * event's limits is checked by the service inside the issuing transaction.
 */
export function validateRegistration(body, { admin = false } = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    name: oneLine(input.name, 120),
    email: oneLine(input.email, 200).toLowerCase(),
    phone: oneLine(input.phone, 20),
    attendees: int(input.attendees, { min: 1, max: 100 }),
    items: [],
    paymentMethod: oneOf(input.paymentMethod, PAYMENT_METHODS, ''),
    txnRef: oneLine(input.txnRef, 100),
    sendEmail: Boolean(input.sendEmail),
  };

  if (value.name.length < 2) errors.name = 'Please tell us your name.';
  // Public names are plain words (any script) — no links or digits that could be passed off as a message.
  else if (!admin && !/^[\p{L}\p{M}][\p{L}\p{M} .'’&-]*$/u.test(value.name)) errors.name = 'Please use letters only for your name.';
  if (!admin || value.email) {
    if (!EMAIL_RE.test(value.email)) errors.email = 'Please enter a valid email address.';
  }
  if (!admin || value.phone) {
    if (!PHONE_RE.test(value.phone) || value.phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Please enter a valid mobile number (10 digits or more).';
    }
  }
  if (!value.attendees) errors.attendees = 'How many people are coming? (1 or more)';

  const seen = new Set();
  for (const item of Array.isArray(input.items) ? input.items.slice(0, 20) : []) {
    const typeId = clean(item?.typeId, 64);
    const quantity = int(item?.quantity, { min: 0, max: 100, fallback: 0 });
    if (!typeId || seen.has(typeId)) continue;
    if (quantity === undefined) {
      errors[`items.${typeId}`] = 'Enter a number between 0 and 100.';
      continue;
    }
    seen.add(typeId);
    if (quantity > 0) value.items.push({ typeId, quantity });
  }
  if (!value.items.length) errors.items = 'Choose at least one coupon.';

  if (!value.paymentMethod) errors.paymentMethod = 'Please choose how you will pay.';
  if (value.paymentMethod === 'txn' && value.txnRef.length < 4) {
    errors.txnRef = 'Enter the UPI / bank transaction ID of your payment.';
  }
  if (value.paymentMethod !== 'txn') value.txnRef = '';

  return Object.keys(errors).length ? { errors } : { value };
}

export function validatePaymentUpdate(body) {
  const status = body?.status;
  if (!PAYMENT_STATUSES.includes(status)) return { errors: { status: 'Choose a payment status.' } };
  return { value: { status, note: clean(body?.note, 500) } };
}
