/**
 * Validation for website events (Admin → Events). Returns { value } (cleaned) or { errors }.
 * Optional bilingual fields that are empty become null, because the public pages check
 * `field && …` before showing them.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const IMAGE_SRC_RE = /^\/media\/announcements\/[\w.-]+\.(jpe?g|png|webp)$/i;
const EMBED_RE = /^https:\/\/(www\.)?google\.com\/maps\/embed\?|^https:\/\/maps\.google\.com\/maps\?/;

/** Icons an event highlight may use. Keep in sync with client/src/components/motifs/Icon.jsx. */
export const EVENT_ICONS = Object.freeze([
  'dhak', 'shankha', 'lotus', 'bhog', 'lamp', 'music', 'book', 'alpana', 'people', 'sindoor', 'calendar', 'pin', 'megaphone',
]);

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
const localized = (field, max, line = true) => ({ en: (line ? oneLine : clean)(field?.en, max), bn: (line ? oneLine : clean)(field?.bn, max) });
const optional = (field) => (field.en || field.bn ? field : null);
const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const validDate = (value) => DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

export const normaliseEventSlug = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** "17.4829, 78.3202" → { lat, lng } (or null). */
export function parseGeo(value) {
  if (value && typeof value === 'object' && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng))) {
    return clampGeo(Number(value.lat), Number(value.lng));
  }
  const m = String(value || '').match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  return m ? clampGeo(Number(m[1]), Number(m[2])) : null;
}
const clampGeo = (lat, lng) => (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 } : null);
export const embedFromGeo = (geo) => `https://maps.google.com/maps?q=${geo.lat},${geo.lng}&z=17&output=embed`;

export function validateEvent(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const tba = input.dateTba === true || (!input.startDate && input.dateTba !== false);

  const value = {
    title: localized(input.title, 140),
    category: optional(localized(input.category, 60)),
    tagline: optional(localized(input.tagline, 200)),
    slug: normaliseEventSlug(input.slug || input.title?.en),
    state: input.state === 'published' ? 'published' : 'draft',
    publishedAt: null,
    featured: Boolean(input.featured),
    startDate: tba ? null : clean(input.startDate, 10),
    endDate: tba ? null : clean(input.endDate, 10) || clean(input.startDate, 10),
    startTime: tba ? '' : clean(input.startTime, 5),
    endTime: tba ? '' : clean(input.endTime, 5),
    dateLabel: tba ? localized(input.dateLabel, 120) : null,
    venue: null,
    summary: localized(input.summary, 400, false),
    description: list(input.description, 20)
      .map((p) => localized(p, 2000, false))
      .filter((p) => p.en || p.bn),
    image: null,
    highlights: [],
    schedule: [],
    scheduleNote: optional(localized(input.scheduleNote, 300)),
    countdown: null,
  };

  if (value.title.en.length < 3) errors['title.en'] = 'Please add the event name (at least 3 characters).';
  if (!value.slug || !SLUG_RE.test(value.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens for the link name.';
  if (!value.summary.en && !value.summary.bn) errors['summary.en'] = 'Please add a short summary (shown on the event card).';

  if (tba) {
    if (!value.dateLabel.en) value.dateLabel.en = 'Date to be announced';
    if (!value.dateLabel.bn) value.dateLabel.bn = 'তারিখ শীঘ্রই';
  } else {
    if (!validDate(value.startDate)) errors.startDate = 'Please choose the date (or tick “Date to be announced”).';
    if (value.endDate && !validDate(value.endDate)) errors.endDate = 'Please choose a valid end date.';
    else if (validDate(value.startDate) && value.endDate < value.startDate) errors.endDate = 'The event can’t end before it starts.';
    if (value.startTime && !TIME_RE.test(value.startTime)) errors.startTime = 'Use a time like 17:00.';
    if (value.endTime && !TIME_RE.test(value.endTime)) errors.endTime = 'Use a time like 19:00.';
    if (value.endTime && !value.startTime) errors.startTime = 'Add a start time too, or clear the end time.';
    if (!errors.startTime && !errors.endTime && value.endTime && value.startDate === value.endDate && value.endTime <= value.startTime) {
      errors.endTime = 'The end time must be after the start time.';
    }
  }

  if (input.publishedAt) {
    const d = new Date(input.publishedAt);
    if (Number.isNaN(d.getTime())) errors.publishedAt = 'Please choose a valid date and time.';
    else value.publishedAt = d.toISOString();
  }

  // Venue: optional as a whole, but a venue needs a name.
  const v = input.venue && typeof input.venue === 'object' ? input.venue : null;
  if (v) {
    const venue = {
      name: localized(v.name, 140),
      spot: optional(localized(v.spot, 140)),
      area: optional(localized(v.area, 140)),
      address: optional(localized(v.address, 300)),
      mapUrl: clean(v.mapUrl, 500),
      mapEmbedUrl: clean(v.mapEmbedUrl, 500),
      geo: parseGeo(v.geo),
    };
    const any = venue.name.en || venue.name.bn || venue.spot || venue.area || venue.address || venue.mapUrl;
    if (any) {
      if (!venue.name.en && !venue.name.bn) errors['venue.name.en'] = 'Please name the venue.';
      if (venue.mapUrl && !isHttps(venue.mapUrl)) errors['venue.mapUrl'] = 'Map link must start with https://';
      if (v.geo && !venue.geo) errors['venue.geo'] = 'Use “latitude, longitude”, e.g. 17.4829, 78.3202.';
      if (venue.geo) venue.mapEmbedUrl = embedFromGeo(venue.geo);
      else if (!EMBED_RE.test(venue.mapEmbedUrl)) venue.mapEmbedUrl = '';
      if (!venue.mapUrl) venue.mapUrl = '';
      value.venue = venue;
    }
  }

  if (input.image && input.image.src) {
    const src = clean(input.image.src, 200);
    if (!IMAGE_SRC_RE.test(src)) errors['image.src'] = 'Please upload the picture again.';
    value.image = {
      src,
      alt: oneLine(input.image.alt, 300),
      width: Math.max(0, Math.min(10000, Number(input.image.width) || 0)) || null,
      height: Math.max(0, Math.min(10000, Number(input.image.height) || 0)) || null,
    };
  }

  list(input.highlights, 12).forEach((h, i) => {
    const item = {
      icon: EVENT_ICONS.includes(h?.icon) ? h.icon : 'lotus',
      title: localized(h?.title, 80),
      text: localized(h?.text, 300, false),
    };
    if (!item.title.en && !item.title.bn && !item.text.en && !item.text.bn) return;
    if (!item.title.en && !item.title.bn) errors[`highlights.${i}.title`] = 'Give this highlight a title.';
    value.highlights.push(item);
  });

  list(input.schedule, 20).forEach((d, i) => {
    const day = {
      date: clean(d?.date, 10),
      day: localized(d?.day, 60),
      note: optional(localized(d?.note, 300)),
      main: Boolean(d?.main),
      items: list(d?.items, 30)
        .map((it) => ({ time: oneLine(it?.time, 20), title: localized(it?.title, 140) }))
        .filter((it) => it.time || it.title.en || it.title.bn),
    };
    if (!day.day.en && !day.day.bn && !day.date && !day.items.length) return;
    if (!day.day.en && !day.day.bn) errors[`schedule.${i}.day`] = 'Name this day (e.g. Maha Ashtami).';
    if (day.date && !validDate(day.date)) errors[`schedule.${i}.date`] = 'Please choose a valid date.';
    day.items.forEach((it, j) => {
      if (!it.title.en && !it.title.bn) errors[`schedule.${i}.items.${j}`] = 'Each item needs a name.';
    });
    value.schedule.push(day);
  });

  // Countdown timer (home page + event page). The admin form sends `enabled`; stored events omit it.
  const cd = input.countdown && typeof input.countdown === 'object' ? input.countdown : null;
  if (cd && (cd.enabled === true || (cd.enabled === undefined && cd.date))) {
    const countdown = {
      date: clean(cd.date, 10),
      time: clean(cd.time, 5) || '00:00',
      label: optional(localized(cd.label, 80)),
      doneMessage: optional(localized(cd.doneMessage, 120)),
    };
    if (!validDate(countdown.date)) errors['countdown.date'] = 'Choose the date to count down to.';
    if (!TIME_RE.test(countdown.time)) errors['countdown.time'] = 'Use a time like 07:00.';
    value.countdown = countdown;
  }

  if (!value.publishedAt) delete value.publishedAt;
  return Object.keys(errors).length ? { errors } : { value };
}
