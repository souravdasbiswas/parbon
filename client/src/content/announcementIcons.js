/**
 * Icons that mark what an announcement is about in the home ticker.
 * Admins can pick one in the announcement form; "Automatic" guesses from the wording.
 * Keep the values in sync with ANNOUNCEMENT_ICONS in server/src/utils/validateAnnouncement.js.
 */
export const ANNOUNCEMENT_ICONS = [
  { value: 'megaphone', label: 'General notice' },
  { value: 'dhak', label: 'Puja' },
  { value: 'people', label: 'Meet-up / gathering / volunteers' },
  { value: 'lamp', label: 'Pronami / donation / sponsorship' },
  { value: 'music', label: 'Cultural programme / music / dance' },
  { value: 'bhog', label: 'Bhog / food' },
  { value: 'calendar', label: 'Dates / schedule' },
  { value: 'book', label: 'Literature / quiz / workshop' },
  { value: 'alpana', label: 'Art / alpana' },
  { value: 'sindoor', label: 'Sindoor khela' },
  { value: 'shankha', label: 'Ritual / anjali / arati' },
];

// First match wins, so specific topics come before the general "puja" rule.
const RULES = [
  ['sindoor', /\bsindo+r\b|\bsindur\b|সিঁদুর/],
  ['bhog', /\bbhog\b|\bkhichuri\b|\bprasad\b|\bfood\b|\blunch\b|\bdinner\b|ভোগ|প্রসাদ/],
  ['music', /\bmusic\b|\bsongs?\b|\bdance\b|\bcultural\b|\bperform|\bconcert\b|\brabindra|সঙ্গীত|গান|নাচ|সাংস্কৃতিক/],
  ['lamp', /\bpronami\b|\bdonat|\bcontribut|\bsponsor|\bupi\b|প্রণামী|অনুদান/],
  ['people', /\bmeet|\bgreet|\btogether\b|\bgathering\b|\bvolunteer|\badda\b|\bmembers?(hip)?\b|আড্ডা|স্বেচ্ছাসেব/],
  ['shankha', /\banjali\b|\barati\b|\baarti\b|\bsandhi\b|\bbodhon\b|অঞ্জলি|আরতি/],
  ['calendar', /\bschedule\b|\btimings?\b|\bnirghanta\b|\bdates?\b|নির্ঘণ্ট/],
  ['book', /\bbooks?\b|\bliterature\b|\bpoetry\b|\brecitation\b|\bworkshop\b|\bquiz\b|আবৃত্তি/],
  ['alpana', /\balpana\b|\bart\b|\bdrawing\b|\brangoli\b|আলপনা/],
  ['dhak', /\bpuja\b|\bpujo\b|\bdurga|\bdhak\b|\bmahalaya\b|পুজো|পূজা|দুর্গা|ঢাক/],
];

const text = (field) => [field?.en, field?.bn].filter(Boolean).join(' ').toLowerCase();

/** Guesses an icon from the title first, then the message; falls back to the megaphone. */
export function guessAnnouncementIcon(announcement) {
  for (const source of [text(announcement?.title), text(announcement?.body)]) {
    if (!source) continue;
    const match = RULES.find(([, re]) => re.test(source));
    if (match) return match[0];
  }
  return 'megaphone';
}

export const announcementIcon = (announcement) =>
  ANNOUNCEMENT_ICONS.some((i) => i.value === announcement?.icon) ? announcement.icon : guessAnnouncementIcon(announcement);

export const iconLabel = (value) => ANNOUNCEMENT_ICONS.find((i) => i.value === value)?.label || '';
