import { config } from '../config.js';

const OK_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 5000;

const stripQuotes = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');

function originOf(url) {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return '';
  }
}

function getHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] || '';
}

function frameAncestorsAllowsSite(csp, siteUrl, targetUrl) {
  const siteOrigin = originOf(siteUrl);
  const targetOrigin = originOf(targetUrl);
  const directives = String(csp)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const ancestor = directives.find((part) => part.toLowerCase().startsWith('frame-ancestors'));
  if (!ancestor) return true;

  const sources = ancestor.split(/\s+/).slice(1).map(stripQuotes);
  if (!sources.length || sources.includes('none')) return false;
  return sources.some((source) => {
    const lower = source.toLowerCase();
    if (lower === '*') return true;
    if (lower === 'self') return Boolean(siteOrigin && targetOrigin && siteOrigin === targetOrigin);
    return lower === siteOrigin;
  });
}

export function sponsorshipEmbeddableFromHeaders(headers, { siteUrl = config.siteUrl, targetUrl = '' } = {}) {
  const xFrameOptions = String(getHeader(headers, 'x-frame-options')).toLowerCase();
  if (/\bdeny\b/.test(xFrameOptions) || /\bsameorigin\b/.test(xFrameOptions)) return false;

  const csp = getHeader(headers, 'content-security-policy');
  if (csp && !frameAncestorsAllowsSite(csp, siteUrl, targetUrl)) return false;

  return true;
}

export function createSponsorEmbeddabilityService({
  fetchImpl = globalThis.fetch,
  siteUrl = config.siteUrl,
  now = () => Date.now(),
  okTtlMs = OK_TTL_MS,
  failureTtlMs = FAILURE_TTL_MS,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  const cache = new Map();
  const pending = new Map();

  const readCached = (url) => {
    const cached = cache.get(url);
    if (!cached || cached.expiresAt <= now()) {
      cache.delete(url);
      return null;
    }
    return cached;
  };

  // Only framing headers prove a page can't be embedded. A slow or failed probe is "unknown" (null), and the
  // sheet then tries the iframe; Apps Script builds the whole page before its first byte, often 3-5 s.
  async function probe(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      response.body?.cancel?.();
      if (!response.ok) return { embeddable: null, failure: true };
      return { embeddable: sponsorshipEmbeddableFromHeaders(response.headers, { siteUrl, targetUrl: response.url || url }), failure: false };
    } catch {
      return { embeddable: null, failure: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async function check(url) {
    if (!url) return null;
    const cached = readCached(url);
    if (cached) return cached.embeddable;
    if (pending.has(url)) return pending.get(url);

    const run = probe(url)
      .then((result) => {
        cache.set(url, {
          embeddable: result.embeddable,
          checkedAt: now(),
          expiresAt: now() + (result.failure ? failureTtlMs : okTtlMs),
        });
        return result.embeddable;
      })
      .finally(() => pending.delete(url));
    pending.set(url, run);
    return run;
  }

  function cachedOrKick(url) {
    if (!url) return null;
    const cached = readCached(url);
    if (cached) return cached.embeddable;
    check(url).catch(() => {});
    return null;
  }

  return {
    check,
    cachedOrKick,
    _cache: cache,
  };
}

export const sponsorEmbeddabilityService = createSponsorEmbeddabilityService();
