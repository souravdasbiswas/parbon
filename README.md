# Parbon Sanskritik Samity · পার্বণ সাংস্কৃতিক সমিতি

> **সংস্কৃতির টানে, একসাথে — Culture brings us together.**

The official website of Parbon Sanskritik Samity, a Bengali cultural community. Its first major initiative is **Sharadiya Durgotsav 2026** (16–21 October 2026).

The site is a **React (Vite) frontend** served by a small **Node.js / Express backend** that also provides a REST API. The Express server handles everything, so one Node app on Hostinger is enough to run it.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Project structure](#2-project-structure)
3. [Architecture](#3-architecture)
4. [Bilingual content model](#4-bilingual-content-model)
5. [Editing content (no code needed)](#5-editing-content-no-code-needed)
6. [Content checklist before launch](#6-content-checklist-before-launch)
7. [REST API](#7-rest-api)
8. [Environment variables](#8-environment-variables)
9. [Deploying to Hostinger](#9-deploying-to-hostinger)
10. [Design system](#10-design-system)
11. [Quality: accessibility, SEO, performance, security](#11-quality)
12. [Extending the site](#12-extending-the-site)

---

## 1. Quick start

**Requirements:** Node.js **22.12+** (see `.nvmrc`) and npm 10+.

```bash
npm install          # installs root, client and server (npm workspaces)
npm run dev          # API on :5000 + Vite dev server on :5173 (proxies /api)
```

Open http://localhost:5173.

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `npm run dev`    | Runs the Express API (auto-restart) and the Vite dev server together |
| `npm run build`  | Builds the React app into `client/dist`                              |
| `npm start`      | Starts the production server (`server.js`): API + built frontend     |
| `npm test`       | Runs the API/server tests (`node:test`, no extra dependencies)       |
| `npm run lint`   | Lints the React code with ESLint                                     |
| `npm run images` | Regenerates optimized logo files from `images/logo.jpeg` (see §10)   |

To try the production build locally:

```bash
npm run build
npm start            # http://localhost:5000
```

---

## 2. Project structure

```
Parbon/
├── server.js                  # Production entry point (Hostinger "entry file")
├── package.json               # npm workspaces + top-level scripts
├── .env.example               # Environment variable template
├── images/logo.jpeg           # Original logo (source artwork, never modified)
├── scripts/optimize-images.mjs
│
├── client/                    # React frontend (Vite)
│   ├── index.html
│   ├── public/                # Static files: favicons, manifest, brand/ (logo derivatives)
│   └── src/
│       ├── main.jsx           # Fonts, global styles, providers
│       ├── router.jsx         # Routes (code-split pages)
│       ├── styles/            # tokens.css (design tokens) + base.css
│       ├── i18n/              # Bilingual content model: pick(), LocaleContext, date formatting
│       ├── services/api.js    # The only module that knows API paths
│       ├── hooks/             # useApi (cached fetch), useCountdown, useRevealOnScroll, …
│       ├── content/           # Editorial copy for each page ({ en, bn } fields)
│       ├── components/
│       │   ├── layout/        # Header, Footer, Layout
│       │   ├── ui/            # Button, SectionHeading, PageHero, EventCard, Schedule, …
│       │   ├── motifs/        # Original SVG artwork: Alpana, PaarBorder, ArchOutline, Icon
│       │   └── forms/         # InquiryForm
│       └── pages/             # Home, About, DurgaPuja, Events, EventDetail, Gallery, …
│
└── server/                    # Node.js backend (Express 5)
    ├── data/                  # ★ Site content as JSON — edit these files to update the site
    ├── media/                 # ★ Uploaded photos (gallery/, committee/) served at /media
    ├── storage/               # Saved enquiries (inquiries.ndjson) — not committed
    ├── src/
    │   ├── index.js           # Starts the HTTP server
    │   ├── app.js             # Express app: security, compression, API, static files, SPA fallback
    │   ├── config.js          # All environment configuration in one place
    │   ├── routes/            # api.js (REST), seo.js (robots.txt, sitemap.xml)
    │   ├── services/          # contentService, inquiryService, mailService
    │   ├── middleware/        # cors, errorHandler
    │   └── utils/validate.js
    └── test/api.test.js
```

---

## 3. Architecture

```
Browser ──► Express (server.js)
             ├── /api/*          REST API (JSON)  ──► contentService ──► server/data/*.json
             │                                     └► inquiryService ──► storage/*.ndjson (+ optional email)
             ├── /media/*        uploaded photos
             ├── /robots.txt, /sitemap.xml         (built from SITE_URL + events)
             ├── /assets/*       hashed JS/CSS/fonts (cached for 1 year)
             └── everything else → client/dist/index.html (React Router)
```

Key decisions:

- **One process, one port.** Express serves the built React app and the API from the same origin, so there's no CORS setup, no second server, and deployment on Hostinger's Node.js hosting is simple.
- **Frontend and backend stay separate.** `client/` and `server/` are separate npm workspaces. The frontend only talks to the backend over REST (`client/src/services/api.js`). You can later host them apart by setting `VITE_API_BASE_URL` and `CORS_ORIGINS`.
- **Content is data.** Events, gallery, committee, sponsorship tiers and contact details live in `server/data/*.json`. The server re-reads a file when it changes, so edits go live without a restart or rebuild.
- **Repository pattern.** `JsonContentRepository` is the only code that knows content lives in files. To move to a database or headless CMS, write a repository with the same `read(name)` method (or swap `createContentService`). Routes and the frontend don't change.
- **No unnecessary infrastructure.** No database, Docker, serverless or third-party services are needed. Email notifications are optional (SMTP).

---

## 4. Bilingual content model

The site mixes Bengali and English on purpose:

- **English** is for clarity: navigation, forms, logistics, practical details.
- **Bengali** is for emotion and identity: section titles, greetings, taglines, storytelling.

Every piece of copy is a **localized field**:

```js
{
  title: { en: 'Our Story', bn: 'আমাদের কথা' },
  description: { en: 'Parbon Sanskritik Samity brings people together…', bn: 'পার্বণ সাংস্কৃতিক সমিতি…' }
}
```

The same shape is used in `client/src/content/pages.js` (editorial copy) and `server/data/*.json` (dynamic content).

In components:

```jsx
const { t } = useLocale();
t(field)            // resolves for the current locale (defaults to English), with fallback
<Bn text={field} /> // always renders Bengali, with lang="bn" (correct font, line-height, screen-reader voice)
<SectionHeading title={{ bn: 'আমাদের কথা', en: 'Our Story' }} />  // bilingual heading treatment
```

**Future language switcher:** `LocaleProvider` already stores the locale (in `localStorage`) and updates `<html lang>`. A switcher only needs to call `setLocale('bn')`. Every component already reads copy through `t()`, so practical content switches to Bengali while the cultural Bengali accents stay as they are.

Dates use `Intl` (`bn-IN` / `en-IN`), so Bengali dates get Bengali numerals automatically (১৬ অক্টোবর). Every Bengali text node has `lang="bn"`.

---

## 5. Editing content (no code needed)

All dynamic content is in **`server/data/`**. Edit the JSON (for example with Hostinger's File Manager). Changes appear on the next page load; no rebuild is needed.

| File             | Controls                                                                             |
| ---------------- | ------------------------------------------------------------------------------------ |
| `site.json`      | Organisation name, contact email/phone/WhatsApp/address, map embed, social links, countdown target |
| `events.json`    | Events: dates, venue, descriptions, day-by-day schedule, highlights, status (`upcoming` / `planned` / `past`) |
| `gallery.json`   | Albums and photos                                                                    |
| `committee.json` | Committee members (the section shows "introduced soon" until you add people)        |
| `support.json`   | Sponsorship tiers, donation methods (UPI + QR), pronami copy, volunteer roles        |

Empty values are hidden automatically. For example, social links with an empty `url`, or an empty `contact.email`, simply don't render.

**Announcements (admin area)**

Committee members sign in at **`/admin`** (the link isn't shown publicly). From there they can create, edit, pin, schedule, save as draft, or delete announcements. Each announcement has:
- a title and message in English, with optional Bengali; line breaks, emoji and links work as they do on WhatsApp
- an image or poster, resized in the browser before upload, which also strips GPS metadata
- an optional location with a Google Maps link, and an optional contact (name, phone, WhatsApp, email)
- an optional button (e.g. "Puja timings" → `/durga-puja`)
- an optional **"Offer pronami"** button

A live preview shows exactly how the WhatsApp-style card will look. Published announcements appear on `/announcements`, the home page (the "New" pill in the hero and the latest cards), and the sitemap. Shared links show the poster and text in WhatsApp and Facebook previews.

**Pronami (donations)**

UPI details live in `support.json → donation.methods` (type `upi`). The QR image is `server/media/donations/upi-qr.svg`. If the UPI ID changes, regenerate both with:

```bash
npm i --no-save qrcode
node scripts/generate-upi-qr.mjs <new-upi-id> "Parbon Sanskritik Samity"
```

Then update `upiId` and `upiLink` in `support.json`. Pronami appears in the home hero (a button that opens a dialog), as an inline panel in the home Durga Puja band, on Get Involved → Pronami, and on announcements that have the button switched on.

**Adding photos to the gallery**

1. Upload images (ideally resized to about 1600px wide, JPEG/WebP) to `server/media/gallery/`.
2. Add entries to `gallery.json`:

```json
"items": [
  {
    "id": "shashthi-bodhon",
    "album": "durga-puja-2026",
    "src": "/media/gallery/shashthi-bodhon.jpg",
    "thumb": "/media/gallery/shashthi-bodhon-small.jpg",
    "width": 1600,
    "height": 1067,
    "alt": { "en": "Priest performing Bodhon on Shashthi evening", "bn": "ষষ্ঠীর সন্ধ্যায় বোধন" },
    "caption": { "en": "Bodhon, Maha Shashthi", "bn": "বোধন, মহাষষ্ঠী" }
  }
]
```

`width`/`height` prevent layout shift, and `thumb` is optional. Always write a meaningful `alt`.

**Adding committee members** (`committee.json`):

```json
"members": [
  { "id": "president", "name": { "en": "Full Name", "bn": "পূর্ণ নাম" }, "role": { "en": "President", "bn": "সভাপতি" }, "photo": "/media/committee/president.jpg" }
]
```

**Adding donation details** (`support.json → donation.methods`):

```json
"methods": [
  { "type": "upi", "label": { "en": "UPI", "bn": "ইউপিআই" }, "details": [ { "label": { "en": "UPI ID" }, "value": "parbon@bank" } ] },
  { "type": "bank", "label": { "en": "Bank transfer" }, "details": [
      { "label": { "en": "Account name" }, "value": "Parbon Sanskritik Samity" },
      { "label": { "en": "Account no." }, "value": "XXXXXXXXXX" },
      { "label": { "en": "IFSC" }, "value": "XXXX0000000" } ] }
]
```

**Editorial copy** (hero text, the story, values, page intros) lives in `client/src/content/pages.js` and `navigation.js`. Changes there need a rebuild (`npm run build`).

**Enquiries** from the contact form are appended to `server/storage/inquiries.ndjson` (one JSON object per line). If SMTP is configured, they're also emailed to `MAIL_TO`.

---

## 6. Content checklist before launch

These values are placeholders on purpose. Fill them in rather than publish invented details:

- [ ] `site.json → contact` — email, phone, WhatsApp, address, `mapEmbedUrl` (Google Maps "Embed a map" URL)
- [ ] `site.json → social` — Facebook / Instagram / YouTube URLs
- [x] `events.json → durga-puja-2026.venue` — Nirusa Banquets & Caterers (on the terrace), Serilingampally, Hyderabad. The venue object has `name`, `spot`, `area`, `address`, `mapUrl` (Google Maps share link), `mapEmbedUrl` (`https://maps.google.com/maps?q=LAT,LNG&z=17&output=embed`) and `geo`. It's shown in the Durga Puja hero, the "Plan your visit" venue card with map, event cards, the event page, the home page Puja band, the Contact page and the Event structured data.
- [x] `events.json → schedule` — Puja timings from the committee's nirghonto: Shashthi 16 Oct (Bodhon 7:00 AM), Saptami 17, Ashtami Bihita 18, Maha Ashtami & Sandhi Puja 19 (7:26–8:14 AM), Navami 20, Dashami 21 Oct 2026. `countdownTo` in `site.json` targets Bodhon. Update both if timings change.
- [ ] `committee.json → members`
- [ ] `support.json → donation.methods` (bank/UPI), and review sponsorship tier benefits
- [ ] `SITE_URL` environment variable = your real domain (used by canonical links, sitemap, robots.txt)
- [ ] SMTP settings, if you want email notifications

---

## 7. REST API

All responses are JSON: `{ "data": … }` on success, `{ "error": { "code", "message", "fields?" } }` on failure.

| Method | Path                  | Description                                                   |
| ------ | --------------------- | ------------------------------------------------------------- |
| GET    | `/api/health`         | Liveness check `{ status, uptime }`                            |
| GET    | `/api/site`           | Organisation details, contact, social links, featured event   |
| GET    | `/api/events`         | Event summaries sorted by date; `?status=upcoming\|planned\|past` |
| GET    | `/api/events/:slug`   | Full event including schedule and highlights (404 if unknown) |
| GET    | `/api/gallery`        | Albums and photos                                             |
| GET    | `/api/committee`      | Committee members                                             |
| GET    | `/api/support`        | Sponsorship tiers, donation methods (UPI), volunteer roles    |
| GET    | `/api/announcements`  | Published announcements, pinned first, newest first; `?limit=n` |
| GET    | `/api/announcements/:slug` | A single published announcement                          |
| POST   | `/api/inquiries`      | Contact / volunteer / membership / sponsorship enquiry        |

Admin endpoints (require the admin session cookie, and reject cross-site requests): `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`, `GET|POST /api/admin/announcements`, `GET|PUT|DELETE /api/admin/announcements/:id`, and `POST /api/admin/uploads` (image as a base64 data URL; the file is checked by its content bytes, max 5 MB).

`POST /api/inquiries` body:

```json
{ "type": "general|volunteer|membership|sponsorship|performance", "name": "…", "email": "…", "phone": "optional", "message": "…" }
```

Returns `201`, or `422` with per-field errors. The endpoint is rate-limited (5 per 15 minutes per IP), capped at 16 KB, validated and normalised on the server, and protected by a honeypot field against spam bots.

---

## 8. Environment variables

Copy `.env.example` to `.env` for local use. On Hostinger, set these in hPanel. Host-provided variables always override `.env`.

| Variable        | Default                  | Purpose                                                        |
| --------------- | ------------------------ | -------------------------------------------------------------- |
| `PORT`          | `5000`                   | Port to listen on (Hostinger sets this automatically)         |
| `NODE_ENV`      | `development`            | Set to `production` in production                              |
| `SITE_URL`      | `http://localhost:5173`  | Public URL, e.g. `https://parbon.org` (sitemap, robots.txt)    |
| `TRUST_PROXY`   | `1`                      | Trust Hostinger's reverse proxy, so rate limiting sees real client IPs |
| `CORS_ORIGINS`  | *(empty)*                | Comma-separated origins, only needed if the frontend is hosted elsewhere |
| `SMTP_HOST` …   | *(empty)*                | Optional email notifications. Hostinger: `smtp.hostinger.com`, `465`, `SMTP_SECURE=true` |
| `SMTP_USER` / `SMTP_PASS` | *(empty)*      | Mailbox credentials (never commit these)                      |
| `MAIL_FROM` / `MAIL_TO`   | —              | Sender, and the committee inbox that receives enquiries       |
| `DATA_DIR` / `MEDIA_DIR` / `STORAGE_DIR` | `server/…` | Optional overrides for content, media and runtime storage (announcements, enquiries) |
| `ADMIN_USERNAME` | *(empty)*            | Admin sign-in name. Admin is disabled until all three admin variables are set |
| `ADMIN_PASSWORD_HASH` | *(empty)*       | scrypt hash from `npm run admin:hash -- "password"` (never the plain password) |
| `SESSION_SECRET` | *(empty)*            | 32+ random characters for signing admin sessions (printed by `admin:hash`) |
| `SESSION_HOURS`  | `8`                  | How long an admin stays signed in                               |
| `VITE_API_BASE_URL` | *(empty)*            | **Build-time** (client). Only for split deployments           |

---

## 9. Deploying to Hostinger

Parbon needs Node.js hosting. On Hostinger that means **Business Web Hosting**, a **Cloud** plan, or a **VPS**. (Premium/Single shared plans only serve static files, so the API and contact form wouldn't work there.)

### Option A — hPanel "Node.js Web App" (recommended)

1. **Put the code on GitHub** (recommended; this enables auto-deploy on push) or zip the project **without** `node_modules`, `client/dist` and `.env`.
2. In **hPanel → Websites → Add website → Node.js Apps** (or *Deploy Node.js app*), choose **Import Git repository** (connect GitHub) or **Upload files** (zip).
3. Build settings:

   | Setting            | Value                                  |
   | ------------------ | -------------------------------------- |
   | Framework preset   | **Express** (or *Other*)               |
   | Node.js version    | **22.x** (or 24.x)                     |
   | Root directory     | `/` (the folder containing the root `package.json`) |
   | Install command    | `npm install` (default)                |
   | Build command      | `npm run build`                        |
   | Entry file / start | `server.js` (start command: `npm start`) |
   | Output directory   | *(leave empty — Express serves `client/dist`)* |

4. **Environment variables:** add `NODE_ENV=production`, `SITE_URL=https://your-domain`, and optionally the SMTP variables. Don't set `PORT`; Hostinger provides it.
5. Click **Deploy**. Once it's done, attach your domain and enable the free SSL certificate in hPanel.
6. Verify:
   - `https://your-domain/api/health` → `{"status":"ok",…}`
   - `https://your-domain/sitemap.xml` lists your real domain
   - Submit a test message on `/contact`

> **Build tools:** Vite is a dev dependency of `client`. If your install step runs with `NODE_ENV=production`, npm skips dev dependencies and the build fails with "vite: not found". Either set `NODE_ENV=production` only for runtime, or use the install command `npm install --include=dev`.

**Updating content on Hostinger:** edit the files in `server/data/` and upload photos to `server/media/` with **File Manager**. The changes are live immediately. If you deploy from Git, commit content changes to the repo too, or a redeploy will overwrite files you edited on the server.

**Persisted data:** these are created at runtime:
- `server/storage/announcements.json` — admin-created announcements, seeded on first run from `server/data/announcements.seed.json`
- `server/storage/inquiries.ndjson` — contact form messages
- `server/media/announcements/` — uploaded announcement images

A Git redeploy can replace the app folder. On Hostinger, set **`STORAGE_DIR`** and **`MEDIA_DIR`** to folders outside the deployment directory (e.g. `/home/<user>/parbon-data/storage` and `/home/<user>/parbon-data/media`), then copy the `server/media` contents there once. After that, redeploys never touch your announcements, images or enquiries.

**Admin on Hostinger:** run `npm run admin:hash -- "your-strong-password"` locally, then add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` as environment variables in hPanel. Sign in at `https://your-domain/admin`. The site must be served over HTTPS in production, because the session cookie is `Secure`.

### Option B — Hostinger VPS (Ubuntu)

```bash
# 1. Install Node 22 and PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2

# 2. Get the code and build
git clone <your-repo-url> /var/www/parbon && cd /var/www/parbon
npm ci && npm run build
cp .env.example .env && nano .env      # NODE_ENV=production, SITE_URL, SMTP…

# 3. Run it (restarts on crash and reboot)
pm2 start server.js --name parbon && pm2 save && pm2 startup
```

Nginx reverse proxy (`/etc/nginx/sites-available/parbon`):

```nginx
server {
  server_name parbon.example.org;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then run `sudo ln -s /etc/nginx/sites-available/parbon /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`, and add HTTPS with `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`.

To update: `git pull && npm ci && npm run build && pm2 restart parbon`.

---

## 10. Design system

**Philosophy:** a traditional Bengali soul with modern web design. Elegant rather than loud. Plenty of whitespace, neutral surfaces, and red/gold used as accents.

- **Palette** (`client/src/styles/tokens.css`): ivory/paper neutrals, sindoor vermilion `#a8201a`, terracotta, muted gold, charcoal and deep brown, plus a natural leaf green for small touches. Text colours meet WCAG AA contrast.
- **Typography** (self-hosted with Fontsource, so there are no Google Fonts requests):
  - *Tiro Bangla*: Bengali display (section titles, taglines)
  - *Cormorant Garamond*: English display (italic sub-titles echo the logo's serif wordmark)
  - *Source Sans 3* + *Noto Sans Bengali*: body text. The font stack lets Bengali glyphs fall through to Noto Sans Bengali automatically, and `unicode-range` subsets mean only the scripts a page uses get downloaded.
  - `:lang(bn)` gets more generous line-height for matras and conjuncts.
- **Motifs** (original SVG in `components/motifs/`): a procedurally drawn **alpana**; the **lal-paar border** (the red border of a Bengali sari) as section dividers; a **temple/pandal arch** framing the logo, day cards and sponsorship tiers; a **lotus divider** echoing the logo; and line icons for dhak, shankha, pradip, bhog, sindoor and lotus.
- **Logo:** the official artwork (`images/logo.jpeg`) is never redrawn. `npm run images` neutralises its cream paper tone to white, trims empty margins and generates AVIF/WebP/PNG sizes, favicons and the social card. The logo sits on a white field, so on ivory surfaces it uses `mix-blend-mode: multiply`, and on dark surfaces it sits on a white arched card.
  To regenerate after replacing the logo: `npm i --no-save sharp && npm run images`. (sharp isn't a dependency, which keeps hosting installs lean.)

---

## 11. Quality

**Accessibility:** semantic landmarks, a skip link, focus moves to the new page's `<h1>` on navigation, visible focus rings, `lang="bn"` on all Bengali text, labelled form fields with `aria-invalid`/`aria-describedby` errors, an accessible mobile menu (Escape to close, focus return), a native `<dialog>` lightbox with keyboard navigation, `prefers-reduced-motion` respected, and 44px+ touch targets. Lighthouse Accessibility scores 100 on all key pages.

**SEO:** per-page `<title>`, description, canonical and Open Graph/Twitter tags (React 19 metadata), Organization JSON-LD, a dynamic `sitemap.xml` and `robots.txt`, real **404 status codes** for unknown URLs, and descriptive alt text. Lighthouse SEO scores 100.

**Performance:** route-level code splitting, a self-hosted font subset, AVIF/WebP logo (190 KB JPEG → about 18–45 KB), gzip compression, immutable 1-year caching for hashed assets, short caching with `stale-while-revalidate` for API content, a de-duplicated in-memory API cache on the client, and space reserved for API-driven content to avoid layout shift.

**Security:** Helmet with a strict Content-Security-Policy (`script-src 'self'`), no `x-powered-by`, input validation and normalisation, request size limits, rate limiting, a honeypot, output rendered safely by React (no `dangerouslySetInnerHTML`), secrets only in environment variables, and `.env` git-ignored. The admin area uses an scrypt-hashed password, a signed `HttpOnly` + `SameSite=Strict` + `Secure` session cookie, origin checks against CSRF, a sign-in rate limit (10 per 15 minutes), content-sniffed image uploads with random file names, and `noindex` on all admin pages.

**Tests:** `npm test` covers the content API, validation, rate limiting, honeypot, Bengali text persistence, security headers, SEO routes and SPA status codes.

---

## 12. Extending the site

- **Language switcher:** add a toggle that calls `useLocale().setLocale('bn' | 'en')`. The content already supports it.
- **Database:** implement a repository (e.g. MySQL, which Hostinger provides) with the same interface as `JsonContentRepository`, and replace `persist()` in `inquiryService.js`.
- **Admin/CMS:** announcements already have a full admin area (`/admin`). Other content (events, gallery) can follow the same pattern: a storage-backed service, `/api/admin/*` routes protected by `requireAdmin` + `sameOrigin`, and a lazy-loaded admin page.
- **New event:** add an object to `events.json` with a unique `slug`. It automatically appears on `/events`, gets its own page `/events/<slug>`, and is added to the sitemap.
- **Online donations:** integrate a payment gateway (e.g. Razorpay) as a new server route. Keep API keys in environment variables.

---

## Image credits

- **Logo:** © Parbon Sanskritik Samity.
- **Alpana, lal-paar border, arch and icons:** original SVG artwork made for this site.
