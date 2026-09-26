/**
 * Language-aware content model.
 *
 * Every piece of copy is a "localized field": { en: '…', bn: '…' } (plain strings are also accepted).
 * - `t(field)` (from useLocale) resolves a field for the *current* locale, falling back gracefully.
 *   Use it for practical content (navigation, forms, event logistics).
 * - `<Bn>` / `pick(field, 'bn')` always render Bengali — for cultural and emotional accents
 *   (section titles, greetings, taglines) that are intentionally Bengali in every locale.
 */
export const SUPPORTED_LOCALES = ['en', 'bn'];
export const DEFAULT_LOCALE = 'en';

export function pick(field, locale = DEFAULT_LOCALE) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field);
  return field[locale] ?? field[DEFAULT_LOCALE] ?? field.bn ?? '';
}
