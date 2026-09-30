const STORE_KEY = 'parbon.passes';
const LEGACY_PREFIX = 'parbon.coupons.';
const CHANGE_EVENT = 'parbon:passes';

const safeJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const asText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.en || value.bn || '';
};

const slugTitle = (slug) =>
  String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizePass = (input, fallback = {}) => {
  const token = input?.token || fallback.token;
  if (!token) return null;
  const event = input?.event || {};
  const type = input?.type || {};
  return {
    token,
    eventSlug: input?.eventSlug || event.slug || fallback.eventSlug || '',
    eventTitle: input?.eventTitle || event.title || fallback.eventTitle || null,
    typeTitle: input?.typeTitle || type.name || input?.typeName || fallback.typeTitle || null,
    date: input?.date || event.startsAt || fallback.date || '',
    savedAt: input?.savedAt || input?.issuedAt || fallback.savedAt || new Date().toISOString(),
  };
};

const removeLegacyToken = (token) => {
  if (typeof window === 'undefined') return;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(LEGACY_PREFIX)) continue;
    const registrations = safeJson(window.localStorage.getItem(key) || '[]', []);
    if (!Array.isArray(registrations)) continue;
    const next = registrations
      .map((registration) => ({ ...registration, coupons: (registration?.coupons || []).filter((coupon) => coupon.token !== token) }))
      .filter((registration) => registration.coupons.length > 0);
    if (JSON.stringify(next) !== JSON.stringify(registrations)) window.localStorage.setItem(key, JSON.stringify(next));
  }
};
const readOwn = () => {
  if (typeof window === 'undefined') return [];
  return safeJson(window.localStorage.getItem(STORE_KEY) || '[]', []).map((p) => normalizePass(p)).filter(Boolean);
};

const readLegacy = () => {
  if (typeof window === 'undefined') return [];
  const passes = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(LEGACY_PREFIX)) continue;
    const eventSlug = key.slice(LEGACY_PREFIX.length);
    const registrations = safeJson(window.localStorage.getItem(key) || '[]', []);
    for (const registration of Array.isArray(registrations) ? registrations : []) {
      for (const coupon of registration?.coupons || []) {
        const pass = normalizePass(
          {
            token: coupon.token,
            typeTitle: coupon.typeName,
            savedAt: registration.at,
          },
          {
            eventSlug,
            eventTitle: registration.event?.title || { en: slugTitle(eventSlug), bn: '' },
            date: registration.event?.startsAt || '',
          },
        );
        if (pass) passes.push(pass);
      }
    }
  }
  return passes;
};

const better = (current, next) => {
  if (!current) return next;
  return {
    ...current,
    ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== null && value !== undefined && value !== '')),
    savedAt: current.savedAt && next.savedAt ? (current.savedAt > next.savedAt ? current.savedAt : next.savedAt) : next.savedAt || current.savedAt,
  };
};

export function listPasses() {
  const byToken = new Map();
  for (const pass of [...readLegacy(), ...readOwn()]) byToken.set(pass.token, better(byToken.get(pass.token), pass));
  return [...byToken.values()].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

export function addPass(input) {
  if (typeof window === 'undefined') return [];
  const pass = normalizePass(input);
  if (!pass) return listPasses();
  const own = readOwn();
  const next = [pass, ...own.filter((p) => p.token !== pass.token)].slice(0, 50);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage can be unavailable in private browsing; the coupon page still works.
  }
  return listPasses();
}

export function removePass(token) {
  if (typeof window === 'undefined') return [];
  const next = readOwn().filter((p) => p.token !== token);
  try {
    removeLegacyToken(token);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Ignore storage errors.
  }
  return listPasses().filter((p) => p.token !== token);
}

export function subscribe(listener) {
  if (typeof window === 'undefined') return () => {};
  const refresh = () => listener(listPasses());
  const onStorage = (event) => {
    if (!event.key || event.key === STORE_KEY || event.key.startsWith(LEGACY_PREFIX)) refresh();
  };
  const onVisible = () => document.visibilityState === 'visible' && refresh();
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, refresh);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, refresh);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export const passText = { asText, slugTitle };
