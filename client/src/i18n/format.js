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

export function formatDateRange(startIso, endIso, lang = 'en') {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start) return '';
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[lang] || lang, { day: 'numeric', month: 'long', year: 'numeric' });
  if (!end || start.getTime() === end.getTime()) return fmt.format(start);
  return typeof fmt.formatRange === 'function' ? fmt.formatRange(start, end) : `${fmt.format(start)} – ${fmt.format(end)}`;
}

export const formatNumber = (n, lang = 'en') => new Intl.NumberFormat(INTL_LOCALE[lang] || lang).format(n);
