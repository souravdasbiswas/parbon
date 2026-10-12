// Uploaded through Admin (/media/announcements/…) or shipped with the site (/sponsors/…).
const LOGO_SRC_RE = /^\/(media\/announcements|sponsors)\/[\w.-]+\.(jpe?g|png|webp)$/i;

const clean = (value, max) =>
  typeof value === 'string'
    ? value
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max)
    : '';

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const dimension = (n) => Math.max(0, Math.min(10000, Math.round(Number(n) || 0))) || null;

/** Validates an admin sponsor payload. Returns { value } or { errors }. */
export function validateSponsor(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};

  const value = {
    name: clean(input.name, 120),
    url: clean(input.url, 500),
    logo: {
      src: clean(input.logo?.src, 200),
      width: dimension(input.logo?.width),
      height: dimension(input.logo?.height),
    },
    tile: Boolean(input.tile),
    status: input.status === 'hidden' ? 'hidden' : 'published',
  };

  if (value.name.length < 2) errors.name = 'Please add the sponsor’s name.';
  if (!isHttpUrl(value.url)) errors.url = 'Website must start with https://';
  if (!value.logo.src) errors['logo.src'] = 'Please upload the sponsor’s logo.';
  else if (!LOGO_SRC_RE.test(value.logo.src)) errors['logo.src'] = 'Please upload the logo again.';

  return Object.keys(errors).length ? { errors } : { value };
}

/** Validates a reorder payload: `{ ids: [...] }` with each id at most once. */
export function validateSponsorOrder(body) {
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string' && id.length <= 64) : null;
  if (!ids || ids.length > 200 || new Set(ids).size !== ids.length) return { errors: { ids: 'Please send the sponsors in their new order.' } };
  return { value: ids };
}
