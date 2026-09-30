# v2 parity checklist

Use this on staging and production preview before switching `UI_VERSION=v2`.

## Global shell

- [ ] v1 sticky header, brand link, language/content access → v2 desktop header and mobile app bar/tab bar → open `/`, tab through header, bottom tabs, and ⋮ menu.
- [ ] v1 hamburger items → v2 bottom tabs plus ⋮ menu (About, Durga Puja, Updates, Gallery, Get involved) → verify Escape closes menus/sheets and focus returns.
- [ ] v1 footer links/contact/social/copyright → v2 footer on desktop and after mobile page content → check footer links from `/about`.
- [ ] Pronami dialog available anywhere → v2 Give tab and sponsor band pronami link → open and close Pronami from `/give`.

## Home `/`

- [ ] Latest ticker/pinned event → desktop ticker and mobile update bubbles → check `/` at mobile and desktop sizes.
- [ ] Hero headline/story CTA → About teaser and `/about` → follow "Our story".
- [ ] Logo arch fallback → desktop hero arch uses event art or large Parbon logo fallback → preview an event without `image`.
- [ ] Countdown/pronami → Event Hub status block and Sponsor/Pronami actions → check countdown and sponsor band.
- [ ] Durga Puja schedule/venue/pronami → Event Hub Schedule, Venue, Sponsor → use `#schedule`, `#venue`, `#sponsor`.
- [ ] Announcement cards → Latest updates and story viewer → tap an update bubble, next/previous, Escape.
- [ ] Upcoming events teaser → Coming up rail → check other events link to their hub.

## About `/about`

- [ ] v1 hero/story/meaning/values/timeline/committee empty state → v2 About page → compare sections and CTAs.
- [ ] Home story/pillars/quote moved here → v2 About sections → read in EN and বাংলা.

## Durga Puja `/durga-puja`

- [ ] v1 shared URL remains valid → v2 Durga Puja Event Hub → status 200.
- [ ] Event JSON-LD → script on every event hub → inspect DOM for `application/ld+json` with `@type: Event`.
- [ ] Meaning, quote, schedule, highlights, visit notes, venue, farewell → Puja extras after hub → click section links.

## Events

- [ ] `/events` upcoming/planned/past lists → v2 Facebook-style event cards → check badges, loading/error-free display.
- [ ] `/events/:slug` meta/OG, facts, countdown, description, schedule, highlights, venue CTA → Event Hub → check anchors `#schedule`, `#passes`, `#sponsor`, `#contact`.
- [ ] Main actions: passes/calendar/directions/share → Event Hub action bar → verify each action on a phone viewport.

## Gallery `/gallery`

- [ ] Album filters/grid/lightbox/keyboard navigation/empty state → v2 shell keeps Gallery → open lightbox, arrow keys/Escape, swipe on mobile.

## Give and Get involved

- [ ] `/get-involved` path cards, volunteer roles, sponsorship tiers, donate panel and anchors → v2 Give content while URL remains valid → test `#volunteer`, `#sponsorship`, `#donate`.
- [ ] `/give` v2-only Give tab → status 200 under v2, redirects to `/get-involved` under v1.
- [ ] Sponsor current event → sheet or external sponsor page fallback → check Apps Script URL and fallback button.

## Contact `/contact`

- [ ] Inquiry form with `?type=` prefill → v2 Contact "Send a message" → `/contact?type=volunteer` selects volunteer.
- [ ] Venue/email/phone/WhatsApp/address/response note/social/map → v2 Contact cards → verify links.
- [ ] Committee people list and community group → v2 Contact top section → fill `server/data/site.json` before launch.

## Announcements

- [ ] `/announcements` feed → v2 Updates route in ⋮ menu → status 200 and cards render.
- [ ] `/announcements/:slug` detail, OG image, share/copy/community actions and 404 → shared detail route → check one valid slug and one invalid slug.
- [ ] Update bubbles → story viewer over the same content → open, next, previous, swipe/Escape.

## Registration, coupons, passes

- [ ] `/register` open-events list → v2 shell keeps registration → status 200.
- [ ] `/register/:slug` form, quantities, UPI, UTR, email-me, closed/sold-out states → registration page → submit a test registration on staging.
- [ ] Issued pass share/copy/send all/remembered registrations → registration result and Passes tab → seed or issue a pass and confirm wallet.
- [ ] `/passes` v2-only wallet → status 200 under v2, redirects to `/register` under v1.
- [ ] `/c/:token` coupon art/status/share/copy/save image/QR/noindex → coupon route → open a seeded pass token and a bad token.

## Admin, scan, 404

- [ ] `/admin/**` admin remains unchanged → sign in and verify announcements/events/coupons/designer/gate/responses/storage.
- [ ] Admin → Events Sponsorship fields → create/edit sponsorship URL, appeal and highlights.
- [ ] `/scan` gate scanner unchanged → load and verify no UI-version styling regressions.
- [ ] Unknown route → bilingual 404 with 404 status → open `/unknown-route`.

## SEO and platform

- [ ] `Seo` title/description/canonical/OG/Twitter/noindex → inspect `/events/durga-puja-2026`, `/give`, `/sponsor/durga-puja-2026`.
- [ ] Server-injected `htmlMeta` previews → fetch shared event/announcement/sponsor HTML and check OG tags.
- [ ] `robots.txt`, `sitemap.xml`, staging noindex → sitemap includes `/give` and `/passes` only under v2.
- [ ] Manifest/favicons/default OG image → browser devtools Application and link-preview smoke test.
- [ ] EN/বাং switch → paragraphs, buttons, dates and Bengali digits switch; bilingual headings stay bilingual.

## Launch runbook

1. Merge `v2` into `main` while production stays on `UI_VERSION=v1`.
2. Sign in to production `/admin`, open `https://parbon.in/?ui=v2`, and confirm the preview badge.
3. Smoke test: `/`, `/about`, `/durga-puja`, `/events`, one `/events/:slug`, `/gallery`, `/get-involved#volunteer`, `/get-involved#sponsorship`, `/get-involved#donate`, `/contact?type=volunteer`, `/announcements`, one announcement, `/register`, one `/register/:slug`, one pass `/c/:token`, `/admin`, `/scan`, `/give`, `/passes`, `/sponsor/durga-puja-2026`, and an unknown URL.
4. Test one full registration → pass appears in wallet → gate scan.
5. Test sponsor flow and external fallback.
6. Flip production to `UI_VERSION=v2` and restart the Node app.
7. Confirm `/api/health` reports `ui.version: "v2"` and rerun the smoke list.
8. Rollback: set `UI_VERSION=v1` and restart. Shared v2 links redirect back to v1 URLs.

## Owner actions

- [ ] Apps Script embed fix: in `doGet`, return the HTML with `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`, then Deploy → Manage deployments → edit existing deployment → New version.
- [ ] In production Admin → Events, set Durga Puja sponsorship URL, appeal and highlights. Seeds do not overwrite existing production events.
- [ ] Fill public contact people, phone, WhatsApp and community links in `server/data/site.json`.
- [ ] Run the staging checklist from the README before the production flip.
