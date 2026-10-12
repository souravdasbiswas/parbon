import { sponsors as copy } from './pages.js';

/** Sponsors from the API (`{ id, name, url, logo, tile }`) as items for the logo variant of the Ticker. */
export const sponsorTickerItems = (list) =>
  list.map((s) => ({
    key: s.id,
    parts: [
      {
        kind: 'logo',
        src: s.logo.src,
        width: s.logo.width || undefined,
        height: s.logo.height || undefined,
        tile: s.tile,
        text: s.name,
        href: s.url,
        ariaLabel: `${s.name} — ${copy.opensSite}`,
      },
    ],
  }));
