/**
 * What a coupon design may contain. Keep in sync with server/src/utils/validateCoupons.js
 * (DESIGN_FONTS, DESIGN_ICONS, element types and the allowed image paths).
 */
export const FONTS = {
  display: { label: 'Cormorant (elegant serif)', css: "'Cormorant Garamond', 'Tiro Bangla', Georgia, serif" },
  body: { label: 'Source Sans (clean)', css: "'Source Sans 3 Variable', 'Noto Sans Bengali Variable', system-ui, sans-serif" },
  bengali: { label: 'Tiro Bangla (বাংলা)', css: "'Tiro Bangla', 'Noto Sans Bengali Variable', serif" },
  bengaliSans: { label: 'Noto Sans Bengali (বাংলা)', css: "'Noto Sans Bengali Variable', 'Source Sans 3 Variable', sans-serif" },
  serif: { label: 'Georgia (classic)', css: "Georgia, 'Times New Roman', serif" },
  mono: { label: 'Monospace (codes)', css: "ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace" },
};

export const ICONS = ['dhak', 'shankha', 'lotus', 'bhog', 'lamp', 'music', 'book', 'alpana', 'people', 'sindoor', 'calendar', 'pin', 'megaphone', 'check'];

/** Placeholders an admin can put in any text; filled per coupon. */
export const FIELDS = [
  { key: 'name', label: 'Holder’s name' },
  { key: 'event', label: 'Event name' },
  { key: 'type', label: 'Coupon type' },
  { key: 'quantity', label: 'Quantity (number)' },
  { key: 'date', label: 'Event date' },
  { key: 'time', label: 'Event time' },
  { key: 'venue', label: 'Venue' },
  { key: 'price', label: 'Price' },
  { key: 'code', label: 'Coupon code' },
];

export const SIZE_PRESETS = [
  { id: 'ticket', label: 'Ticket (landscape)', width: 1200, height: 560 },
  { id: 'card', label: 'Card (portrait)', width: 800, height: 1200 },
  { id: 'square', label: 'Square', width: 1000, height: 1000 },
  { id: 'story', label: 'Phone screen (tall)', width: 720, height: 1280 },
];

export const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export const fillFields = (text, data) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, key) => String(data?.[key] ?? m));

const IST_DATE = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const IST_DAY = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
const IST_TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

export function eventDateText(startsAt, endsAt) {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (!end || IST_DATE.format(start) === IST_DATE.format(end)) return IST_DATE.format(start);
  return `${IST_DAY.format(start)} – ${IST_DATE.format(end)}`;
}

export function eventTimeText(startsAt, endsAt) {
  if (!startsAt) return '';
  return endsAt ? `${IST_TIME.format(new Date(startsAt))} – ${IST_TIME.format(new Date(endsAt))}` : IST_TIME.format(new Date(startsAt));
}

export const priceText = (price) => (price > 0 ? `₹${price}` : 'Free');

/** Values for the placeholders, from a coupon (or sample data in the designer). */
export function couponFieldData({ holder, event, type, quantity, code, url }) {
  return {
    name: holder || '',
    event: event?.title?.en || '',
    type: type?.name?.en || '',
    quantity: quantity ?? '',
    date: eventDateText(event?.startsAt, event?.endsAt),
    time: eventTimeText(event?.startsAt, event?.endsAt),
    venue: event?.venue?.name || '',
    price: priceText(type?.price || 0),
    code: code || '',
    url: url || '',
  };
}

export function sampleFieldData(event, type) {
  const origin = typeof window === 'undefined' ? 'https://parbon.in' : window.location.origin;
  return couponFieldData({
    holder: 'Ananya Sen',
    event: event || { title: { en: 'Durga Puja 2026' }, startsAt: '2026-10-16T10:30:00.000Z', endsAt: '2026-10-21T17:30:00.000Z', venue: { name: 'Nirusa Banquets' } },
    type: type || { name: { en: 'Entry pass' }, price: 0 },
    quantity: 4,
    code: 'PQ7K-M3XD',
    url: `${origin}/c/SAMPLEcouponPREVIEW000`,
  });
}

let counter = 0;
export const newElementId = (type) => `${type}${Date.now().toString(36)}${(counter++).toString(36)}`;
