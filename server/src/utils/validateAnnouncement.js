const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{6,20}$/;
const IMAGE_SRC_RE = /^\/media\/announcements\/[\w.-]+\.(jpe?g|png|webp)$/i;

const clean = (value, max = 500) =>
  typeof value === 'string'
    ? value
        .normalize('NFC')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\r\n?/g, '\n')
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
// Site-relative links such as /durga-puja (but not protocol-relative //evil.example).
const isSitePath = (value) => /^\/(?!\/)[\w\-/.#?=&%]*$/.test(value);

const localized = (field, max) => ({ en: clean(field?.en, max), bn: clean(field?.bn, max) });
const compact = (obj) => (Object.values(obj).some((v) => v !== '' && v != null) ? obj : null);

/** Ticker icons an admin may choose (null = pick automatically). Keep in sync with client/src/content/announcementIcons.js. */
export const ANNOUNCEMENT_ICONS = Object.freeze([
  'megaphone',
  'dhak',
  'people',
  'lamp',
  'music',
  'bhog',
  'calendar',
  'book',
  'alpana',
  'sindoor',
  'shankha',
]);

/** Validates an admin announcement payload. Returns { value } or { errors }. */
export function validateAnnouncement(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};

  const value = {
    title: localized(input.title, 140),
    body: localized(input.body, 5000),
    status: input.status === 'draft' ? 'draft' : 'published',
    pinned: Boolean(input.pinned),
    showDonation: Boolean(input.showDonation),
    // Older clients don't send this field; announcements are in the ticker unless unticked.
    showInTicker: input.showInTicker === undefined ? true : Boolean(input.showInTicker),
    icon: ANNOUNCEMENT_ICONS.includes(input.icon) ? input.icon : null,
    publishedAt: null,
    slug: clean(input.slug, 80),
    image: null,
    location: compact({
      name: clean(input.location?.name, 140),
      address: clean(input.location?.address, 300),
      mapUrl: clean(input.location?.mapUrl, 500),
    }),
    contact: compact({
      name: clean(input.contact?.name, 100),
      phone: clean(input.contact?.phone, 20),
      whatsapp: clean(input.contact?.whatsapp, 20),
      email: clean(input.contact?.email, 200).toLowerCase(),
    }),
    link: compact({ label: clean(input.link?.label, 60), url: clean(input.link?.url, 500) }),
  };

  if (value.title.en.length < 3) errors['title.en'] = 'Please add a title (at least 3 characters).';
  if (value.body.en.length < 3 && value.body.bn.length < 3) errors['body.en'] = 'Please write the announcement text.';

  if (input.publishedAt) {
    const d = new Date(input.publishedAt);
    if (Number.isNaN(d.getTime())) errors.publishedAt = 'Please choose a valid date and time.';
    else value.publishedAt = d.toISOString();
  }

  if (input.image && input.image.src) {
    const src = clean(input.image.src, 200);
    if (!IMAGE_SRC_RE.test(src)) errors['image.src'] = 'Please upload the image again.';
    value.image = {
      src,
      alt: clean(input.image.alt, 300),
      width: Math.max(0, Math.min(10000, Number(input.image.width) || 0)) || null,
      height: Math.max(0, Math.min(10000, Number(input.image.height) || 0)) || null,
    };
  }

  if (value.location?.mapUrl && !isHttpUrl(value.location.mapUrl)) errors['location.mapUrl'] = 'Map link must start with https://';
  if (value.contact?.phone && !PHONE_RE.test(value.contact.phone)) errors['contact.phone'] = 'Please enter a valid phone number.';
  if (value.contact?.whatsapp && !PHONE_RE.test(value.contact.whatsapp)) errors['contact.whatsapp'] = 'Please enter a valid WhatsApp number.';
  if (value.contact?.email && !EMAIL_RE.test(value.contact.email)) errors['contact.email'] = 'Please enter a valid email address.';
  if (value.link?.url && !isHttpUrl(value.link.url) && !isSitePath(value.link.url)) {
    errors['link.url'] = 'Link must start with https:// or / (for a page on this site).';
  }
  if (value.link && !value.link.url) errors['link.url'] = 'Please add the link address, or clear the label.';

  if (!value.slug) delete value.slug;
  if (!value.publishedAt) delete value.publishedAt;
  return Object.keys(errors).length ? { errors } : { value };
}
