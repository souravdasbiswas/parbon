const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const toBengaliDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const INTL_LOCALE = { en: 'en-IN', bn: 'bn-IN' };

/** Parses a YYYY-MM-DD string as a local calendar date (avoids UTC off-by-one shifts). */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDate(iso, lang = 'en', options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = parseDate(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat(INTL_LOCALE[lang] || lang, options).format(date);
}

export function formatDateRange(startIso, endIso, lang = 'en', options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start) return '';
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[lang] || lang, options);
  if (!end || start.getTime() === end.getTime()) return fmt.format(start);
  return typeof fmt.formatRange === 'function' ? fmt.formatRange(start, end) : `${fmt.format(start)} – ${fmt.format(end)}`;
}

export const formatNumber = (n, lang = 'en') => new Intl.NumberFormat(INTL_LOCALE[lang] || lang).format(n);

/** "17:00", "19:00" → "5:00 – 7:00 pm" (India English style); a single time when there is no end. */
export function formatTimeRange(start, end) {
  const fmt = (hhmm) => {
    if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(Date.UTC(2000, 0, 1, h, m));
  };
  const s = fmt(start);
  const e = fmt(end);
  if (!s) return '';
  return e ? `${s} – ${e}` : s;
}
