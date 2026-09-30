export const DEFAULT_UI_VERSION = 'v1';

export const UI_VERSIONS = Object.freeze(['v1', 'v2']);

export const UI_VERSION_ROUTE_CHUNKS = Object.freeze({
  v1: 'src/ui/v1/routes.jsx',
  v2: 'src/ui/v2/routes.jsx',
});

export const V2_ONLY_CLIENT_ROUTES = Object.freeze(['/give', '/passes', '/sponsor/:slug?']);

export const V2_ONLY_SITEMAP_PAGES = Object.freeze([
  { path: '/give', priority: '0.6', changefreq: 'monthly' },
  { path: '/passes', priority: '0.7', changefreq: 'weekly' },
  { path: '/sponsor', priority: '0.6', changefreq: 'monthly' },
]);

export const isAllowedUiVersion = (version) => UI_VERSIONS.includes(version);

export function resolveConfiguredUiVersion(raw) {
  const value = String(raw || '').trim() || DEFAULT_UI_VERSION;
  if (isAllowedUiVersion(value)) return { version: value, warning: '' };
  return {
    version: DEFAULT_UI_VERSION,
    warning: `Invalid UI_VERSION "${value}", falling back to ${DEFAULT_UI_VERSION}. Allowed: ${UI_VERSIONS.join(', ')}.`,
  };
}

export function isV2OnlyClientRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return clean === '/give' || clean === '/passes' || clean === '/sponsor' || /^\/sponsor\/[a-z0-9-]+$/.test(clean);
}

export function v1RedirectForV2OnlyRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/give') return '/get-involved';
  if (clean === '/passes') return '/register';
  if (clean === '/sponsor') return '/get-involved';
  const sponsor = clean.match(/^\/sponsor\/([a-z0-9-]+)$/);
  if (sponsor) return `/events/${sponsor[1]}`;
  return null;
}
