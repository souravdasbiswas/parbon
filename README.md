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
5. [Editing content (no code needed)](#5-editing-content-no-code-needed) · [Coupons](#coupons-event-registration-digital-coupons-and-gate-check-in)
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
| `npm test`       | Runs the API/server tests (`node:test`; MySQL tests run when `TEST_DB_HOST` is set) |
| `npm run lint`   | Lints the React code with ESLint                                     |
| `npm run images` | Regenerates optimized logo files from `images/logo.jpeg` (see §10)   |
| `npm run db:migrate` | Imports old file data into MySQL (`--dry-run`, `--from <folder>`; see [Database](#database-mysql)) |
| `npm run images:updates` | Prepares announcement posters from `images/updates/` (see §5) |

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
├── images/updates/<year>/     # Original announcement posters: YYYY-MM-DD-<slug>.jpg
├── scripts/optimize-images.mjs
├── scripts/prepare-update-images.mjs
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
│       │   ├── coupons/       # CouponArt (renders a coupon design), QrCode, templates, designSpec
│       │   └── forms/         # InquiryForm
│       └── pages/             # Home, About, DurgaPuja, Events, EventDetail, Gallery, …
│                              # coupons/ (Register, CouponView), scan/ (gate scanner), admin/coupons/ (events, designer)
│
└── server/                    # Node.js backend (Express 5)
    ├── data/                  # ★ Site content as JSON — edit these files to update the site
    ├── media/                 # ★ Uploaded photos (gallery/, committee/) served at /media
    ├── storage/               # File store when no database is configured — not committed
    ├── src/
    │   ├── index.js           # Starts the HTTP server (and connects to MySQL if configured)
    │   ├── app.js             # Express app: security, compression, API, static files, SPA fallback
    │   ├── config.js          # All environment configuration in one place
    │   ├── db/                # MySQL: connection + schema, announcements table, one-time import of old files
    │   ├── routes/            # api.js (REST), admin.js, coupons.js (registration, admin, scanner), seo.js
    │   ├── services/          # content, announcements, inquiries, responses, uploads, mail, coupons
    │   ├── middleware/        # cors, errorHandler, auth
    │   └── utils/             # validation, CSV
    └── test/                  # node:test suites (MySQL suite runs when TEST_DB_HOST is set)
```

---

## 3. Architecture

```
Browser ──► Express (server.js)
             ├── /api/*          REST API (JSON)  ──► contentService ──► server/data/*.json
             │                                     └► inquiryService ──► MySQL `inquiries` or storage/*.ndjson (+ optional email)
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
- **No unnecessary infrastructure.** No Docker, serverless or third-party services are needed. A MySQL database is optional: it's recommended on Hostinger so runtime data survives redeploys, and without it the app uses files. Email notifications are optional (SMTP).

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

A live preview shows exactly how the WhatsApp-style card will look. Published announcements appear on `/announcements`, the home page (the running-text ticker at the top of the hero and the latest cards), and the sitemap. Shared links show the poster and text in WhatsApp and Facebook previews.

**Home ticker (running text)**

The band at the top of the home hero scrolls:
1. A fixed **"NEW · Durga Puja 2026 · 16–21 Oct at 📍 venue"** item. The title and dates open `/durga-puja`, and the venue opens Google Maps. The title, dates, venue name/area and map link come from the `durga-puja-2026` entry in `server/data/events.json` (`title`, `startDate`, `endDate`, `venue.name`, `venue.area`, `venue.mapUrl`), so edit that file to change them.
2. Up to **3 announcements** that have **"Show in the home page ticker"** ticked (new announcements start ticked). Pinned ones come first, then the newest, and each links to its page. To choose which three appear, tick or untick that box when editing an announcement. The admin Announcements list shows an **In ticker** badge on the ones currently shown, and **Ticker full** on ticked ones that don't fit.

Each item starts with a topic icon, so its subject is clear at a glance: a dhak for the Puja item, and for announcements a people, lamp (pronami/donation), music, bhog, calendar, book, alpana, sindoor, shankha or megaphone icon. By default it's chosen automatically from words in the title (then the message), e.g. "meet & greet" → people, "cultural" → music. Admins can override it with the **Ticker icon** dropdown in the announcement form, which also previews the automatic choice. The keyword rules are in `client/src/content/announcementIcons.js`.

It pauses on hover, keyboard focus or touch, and it becomes a static, horizontally scrollable row for visitors who prefer reduced motion.

**Announcements from the repo (posters in `images/updates/`)**

Announcements can also ship with the code, which keeps the original posters under version control:

1. Save the original poster as `images/updates/<year>/<YYYY-MM-DD>-<slug>.jpg` (publish date + a short lowercase slug), e.g. `images/updates/2026/2026-09-27-lets-get-together.jpeg`.
2. Run `npm i --no-save sharp && npm run images:updates`. It writes `server/media/announcements/<slug>.jpg` (+ `.webp`), max 1600px wide with metadata stripped, and prints the `image` block with its width and height. Posters that were already prepared are left untouched (`-- --force` regenerates them).
3. Add an entry to `server/data/announcements.seed.json` with a new unique `id`, the `slug`, the text, and that `image` block (copy an existing entry as a template).

On the next start (or deploy), new seed entries are merged into the live store once. Announcements added in the admin are kept, and a seed entry deleted in the admin stays deleted. If `MEDIA_DIR` points outside the app folder, copy the new poster there too.

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

**Viewing form responses (admin)**

Signed-in admins can open **Responses** in the admin bar (`/admin/responses`). The page reads `inquiries.ndjson` **read-only**: it never changes the file or how the form saves. It shows every submission in a table with these columns: received (IST), type, name, email, phone, message, reference ID, IP address and browser.
- Click a column heading to sort; click it again to reverse the order. Newest submissions are shown first by default.
- Filter by type (the chips show counts), and search across name, email, phone and message.
- Email addresses and phone numbers are clickable (email, call, WhatsApp). Long messages expand with *Show more*.
- **Export CSV** downloads everything that matches the current filter, search and sort, not just the visible page, as `parbon-responses-YYYY-MM-DD.csv`. The file is UTF-8 with a BOM, so Excel shows Bengali correctly. Cells that look like spreadsheet formulas are prefixed with `'` so they can't run.
- Damaged or partial lines in the file are skipped, and the page says how many were skipped.

The file is the only copy of these messages, apart from any notification emails. Download a backup now and then, and set `STORAGE_DIR` outside the app folder (see [Deploying to Hostinger](#9-deploying-to-hostinger)).

### Coupons: event registration, digital coupons and gate check-in

Admins can sell or give out digital coupons for an event (entry passes, bhog coupons and so on), and volunteers scan them at the gate with a phone. **Coupons need the MySQL database** (`DB_*` variables). Without it the feature switches itself off, and the rest of the site keeps working.

**1. Set up the event** (**Admin → Coupons → New event**)
- **Quickest:** pick a **ready-made event**: Durga Puja, Bijoya Sammilani, Kojagori Lakshmi Puja, Kali Puja & Diwali, Saraswati Puja, Poila Boishakh, Cultural evening / concert or Meet-up / adda.
  - The form fills itself in, and its coupon types (e.g. *Entry pass*, *Ashtami bhog*, *Navami bhog*, *Cultural night pass*) are created already designed.
  - Untick any you don’t need, or change the prices.
  - The venue, help contact and payment details are copied from your most recent event.
  - Check the dates, then **Create**. Or choose *Start from scratch*.
- Fill in the name, dates, venue, the **total number of coupons** (e.g. 500) and the most people per registration.
- The **link name** becomes the public page, e.g. `/register/durga-puja-2026`.
- *Show a “Get your coupons” button on* adds a button to that website event page (and to `/durga-puja` for Durga Puja 2026).
- **Payment**: there is no payment gateway. Choose whether people can pay by UPI and enter the transaction ID, choose “I’ll pay at the counter”, or allow both. The UPI ID starts out as the site’s donation UPI.
- **Coupon links stop working** at the time you set; if you leave it empty, that’s when the event ends. After that, coupon links show “This event is over” and the scanner refuses them.

**2. Add coupon types** (tab *Coupon types & designs*)
- Each type has a name (English and Bengali), a kind (*Entry pass*, *Food / bhog*, *Other*), a price (0 = free), an optional limit of its own and a most-per-registration.
- When adding a type, pick its look from the design gallery.

**3. Design each coupon** (*Design coupon*)
- *Browse ready-made designs* offers 18 designs grouped by occasion:
  - **Durga Puja:** sindoor red ticket, Sharat sky & kash phool, Dhaker taal at night, lal-paar sari card, Shiuli morning
  - **Bhog & food:** banana leaf, marigold prasad, bhog gold
  - **Cultural night:** stage night, concert poster, festive red card
  - **Bijoya:** sindoor khela
  - **Lakshmi & Kali Puja:** Kojagori full moon, diya glow
  - **Saraswati Puja:** basanti yellow
  - **Poila Boishakh:** mango toran
  - **VIP & donors:** black & gold
  - **Any event:** simple & clean
- Their artwork (kash phool, dhak, lal paar, marigold, diya, moon…) is in `client/public/brand/coupon-*.png`. It is drawn by `scripts/generate-coupon-art.mjs`: run `npm i --no-save sharp && node scripts/generate-coupon-art.mjs` to redraw it.
- It’s a visual editor. Drag things to move them and drag the white squares to resize; it snaps to the centre and edges (hold Alt to turn that off).
- Change text, fonts (including Bengali), size, colour, alignment, backgrounds (colour, gradient or an uploaded picture), the border and the icons.
- Add text, fields (`{{name}}`, `{{event}}`, `{{type}}`, `{{quantity}}`, `{{date}}`, `{{time}}`, `{{venue}}`, `{{price}}`), the QR code, the coupon code, the Parbon logo, pictures and shapes.
- Undo/redo (Ctrl+Z / Ctrl+Y), arrow keys to nudge, Delete to remove. *Sample data* shows how a real coupon will look, and *PNG* downloads a preview.
- Every design must keep a visible QR code. Saving updates coupons already issued as well.

**4. Open registrations**: set *Registrations* to **Open** and share the link from the *Overview* tab (Copy or WhatsApp).
- People enter their name, mobile, email and number of people, choose how many of each coupon they want, then pay by UPI (a QR code with the amount filled in, plus a transaction ID box) or choose “pay at the counter”.
- They get **one coupon per type with a quantity**, e.g. *Entry pass ×4* is one QR code that lets 4 people in, and they don’t have to arrive together.
- Each coupon has a short code (e.g. `PQ7K-M3XD`) and its own private link (`/c/…`), with buttons to share on WhatsApp or copy.
- If email is set up (see below), they can also get the links by email. The same phone remembers them on the registration page.
- Limits are checked at the moment coupons are issued, so they can never be oversold.

**5. At the gate**: open **`/scan`** on a phone.
- **Website admins can always scan**: sign in at `/admin` and open `/scan`. They can do everything, for every event.
- **Gate volunteers** sign in with the **username and PIN** the admin gave them (see *Gate team* below).
- Scan the QR code with the camera or type the code. The screen turns **green** (valid), **amber** (already used) or **red** (cancelled, replaced, wrong event, event over).
- Tap *Let 4 in* or let only some in. *Mark paid* records money collected at the counter, and *Undo* reverses a mistaken check-in. Volunteers only see these two buttons if the admin allowed them.

**6. Follow up** (tab *Attendees & coupons*)
- Filter by *Not in yet*, *Partly in*, *All in* or *Cancelled*, and by payment status. You can search by name, phone, email, code or transaction ID.
- Change a payment status (To verify, Pay at counter, Paid, Rejected).
- For a single coupon: **Cancel** it, or **Reissue** it (new code and link; the old link stops working at once and check-ins carry over). Reissuing a cancelled coupon brings it back.
- *+ Walk-in* records a booking made at the counter or over the phone. *Download CSV* exports everyone.

**Email (optional)**: Hostinger mailboxes can send to anyone. Set `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=mail@parbon.in`, `SMTP_PASS=…` and `MAIL_FROM="Parbon Sanskritik Samity <mail@parbon.in>"`. The registration form then offers “Also email me my coupons”, and admins get *Email coupons*. Hostinger limits how many emails a mailbox sends per day, which is plenty for one email per registration.
- **Anti-abuse:** coupon emails contain only the committee’s own text (event, venue, coupon names) plus the coupon codes and links, never what the registrant typed. The public form sends at most 3 coupon emails per address and 10 per network each day; above that, people still get their links on screen. Public registrations accept plain names only: letters in any script, spaces and `. ' - &`.

**Gate team** (**Admin → Gate team**, or *Coupons → Gate team*): people who check coupons at the entrance and the bhog counter, without being website admins.
- **Add volunteer**: enter a name. A username is suggested from it, e.g. `rahul.das`. Type a 4–6 digit PIN or leave it empty to get one.
- Choose what they may do:
  - Scanning and letting people in is always allowed.
  - Tick *Take payments* to let them mark coupons as paid at the counter.
  - Tick *Undo* to let them undo a check-in made by mistake.
- Choose which events: all events, or only the ones you pick.
- The PIN is shown **once**, with *Send on WhatsApp* and *Copy details* (scanner link, username and PIN). It can’t be viewed again; use **Reset PIN** to give a new one.
- **Turn off**, **Reset PIN** and **Delete** sign the volunteer out on their phone straight away. Changes to their permissions apply straight away too.
- Volunteers can only use the scanner. They can’t open any admin page.
- After 5 wrong PINs in a row, that account is locked for 15 minutes; after 20 in a day, for the rest of the day. A PIN reset unlocks it. Usernames must match exactly, so look-alike spellings can’t get round the lock.
- The list shows each volunteer’s last sign-in and how many people they checked in. Check-in history records who let people in.
- Volunteer accounts are stored in the database, so there’s no server setting to change.

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

Admin endpoints (require the admin session cookie, and reject cross-site requests): `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`, `GET|POST /api/admin/announcements`, `GET|PUT|DELETE /api/admin/announcements/:id`, `POST /api/admin/uploads` (image as a base64 data URL; the file is checked by its content bytes, max 5 MB), and the read-only `GET /api/admin/responses` and `GET /api/admin/responses/export.csv` (both accept `type`, `q`, `sort` = `createdAt|type|name|email|phone|ip`, and `dir` = `asc|desc`).

`POST /api/inquiries` body:

```json
{ "type": "general|volunteer|membership|sponsorship|performance", "name": "…", "email": "…", "phone": "optional", "message": "…" }
```

Returns `201`, or `422` with per-field errors. The endpoint is rate-limited (5 per 15 minutes per IP), capped at 16 KB, validated and normalised on the server, and protected by a honeypot field against spam bots.

**Coupons** (need MySQL; see [Coupons](#coupons-event-registration-digital-coupons-and-gate-check-in)):

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/coupons/status` | `{ enabled, mailEnabled }` |
| GET | `/api/coupons/events` | Events open for registration; `?linked=<site-event-slug>` |
| GET | `/api/coupons/events/:slug` | Event, coupon types, prices and places left |
| POST | `/api/coupons/events/:slug/register` | Register and get coupons (rate-limited, honeypot). `422` per-field errors, `409` sold out or closed |
| GET | `/api/coupons/c/:token` | A coupon for its page; `410` once the event's links have expired |

Admin coupon endpoints live under `/api/admin/coupons/…`: events, types, designs, registrations, walk-ins, payment status, cancel and reissue, resend email, `events/:id/export.csv`, and gate volunteers (`gate-users`, `gate-users/:id`, `gate-users/:id/reset-pin`).

The gate scanner uses `/api/admin/scan/…`: `login` (username + PIN), `logout`, `me`, `events`, `events/:id/stats`, `lookup`, `checkin`, `undo` and `mark-paid`. These accept an admin session (every permission) or a gate volunteer session. The server checks a volunteer's permissions and allowed events on every request.

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
| `SMTP_HOST` …   | *(empty)*                | Optional email: enquiry notifications, and coupon emails to people who register. Hostinger: `smtp.hostinger.com`, `465`, `SMTP_SECURE=true` |
| `SMTP_USER` / `SMTP_PASS` | *(empty)*      | Mailbox credentials (never commit these)                      |
| `MAIL_FROM` / `MAIL_TO`   | —              | Sender, and the committee inbox that receives enquiries       |
| `DATA_DIR` / `MEDIA_DIR` / `STORAGE_DIR` | `server/…` | Optional overrides for content, media and runtime storage (announcements, enquiries) |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL/MariaDB server. On Hostinger use `127.0.0.1` (not `localhost`, which can resolve to IPv6 `::1`) |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | *(empty)* | Database for announcements, form responses and uploaded images (see [Database](#database-mysql)). Empty `DB_NAME` = file storage |
| `LEGACY_IMPORT_DIRS` | *(empty)* | Extra old app folders to import once into the database. Earlier Hostinger deployments are found automatically |
| `ADMIN_USERNAME` | *(empty)*            | Admin sign-in name. Admin is disabled until all three admin variables are set |
| `ADMIN_PASSWORD_HASH` | *(empty)*       | scrypt hash from `npm run admin:hash -- "password"` (never the plain password) |
| `SESSION_SECRET` | *(empty)*            | 32+ random characters for signing admin sessions (printed by `admin:hash`) |
| `SESSION_HOURS`  | `8`                  | How long an admin stays signed in                               |
| `SCANNER_SESSION_HOURS` | `16`          | How long a gate volunteer stays signed in to the scanner (volunteers are managed under *Gate team*) |
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

**Persisted data:** announcements, contact-form messages and uploaded announcement images are created at runtime. **Hostinger's Node.js hosting builds each deployment into a new folder, so anything saved inside the app folder is lost on the next deploy.** Use the database (below) so this data survives.

#### Database (MySQL)

With `DB_NAME` and `DB_USER` set, the app stores these in MySQL/MariaDB:

| Table | Holds |
| --- | --- |
| `announcements` | Admin-created announcements (whole record as JSON in `data`) |
| `announcement_seeds` | Seed entries already merged once, so a seed an admin deletes stays deleted |
| `inquiries` | Contact-form submissions (shown on `/admin/responses`) |
| `media` | Uploaded announcement images and coupon pictures, served from `/media/announcements/<name>` |
| `data_imports` | Old files already imported (by content hash) |
| `coupon_events`, `coupon_types` | Coupon events and their coupon types, including each type's design (JSON in `data`) |
| `coupon_registrations` | Who registered: name, email, phone, number of people, payment method, transaction ID, payment status |
| `coupons` | Issued coupons: code, private link token, quantity, how many used, status (active/cancelled/replaced) |
| `coupon_checkins` | Every gate check-in (and undo), with time and who scanned |
| `gate_users` | Gate volunteers: username, name, PIN hash (never the PIN), permissions, allowed events, last sign-in |

The tables are created automatically on start, so no SQL needs to be run by hand. `https://your-domain/api/health` shows `"storage": "mysql"` and `"database": "connected"` when the database is in use. The admin **Storage** page (`/admin/storage`) shows row counts, the old folders checked and what was imported.

##### Switching the live site to MySQL (first time)

The migration runs by itself when the new version starts. There's no script to run and no downtime.

1. **Back up first (recommended):** in hPanel → File Manager, open the running deployment's folder (`/home/<user>/domains/<site>/hbuilds/versions/<newest id>/nodejs/server/`). Download `storage/` and `media/announcements/`.
2. **hPanel → Databases → Management:** note the database name and user, and reset the user's password if needed.
3. **Websites → your site → Environment variables:** add `DB_NAME`, `DB_USER` and `DB_PASSWORD`. `DB_HOST` (`127.0.0.1`) and `DB_PORT` (`3306`) are the defaults. Also make sure `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` are set.
4. **Deploy.** When the new version starts, it:
   - creates the tables;
   - finds the **earlier deployment folders** next to it (`hbuilds/versions/*/nodejs`) and imports their announcements, form responses and uploaded images. Nothing needs to be set;
   - checks those folders again **2 and 10 minutes later**, to catch any form sent to the old version while the switch was happening.

   While this happens, the old version keeps serving until Hostinger switches traffic, so visitors see no gap.
5. **Check:**
   - `/api/health` → `"database": "connected"`;
   - `/admin/storage` → the counts match what you expect;
   - `/admin/responses` lists earlier registrations;
   - announcement images load.
   The runtime log shows `[parbon] imported into MySQL: …`.

How the import treats data:
- Old files are **only read, never changed**.
- Each file is imported once (tracked by content hash in `data_imports`). Rows use `INSERT IGNORE`, so nothing already in the database is overwritten or duplicated, and later redeploys import nothing new.
- Every deployment used to start from an empty folder, so each old folder may hold announcements that exist nowhere else. All announcement snapshots are therefore merged, newest first; if the same announcement appears twice, the latest edit wins. An announcement deleted in one old deployment could come back if another old folder still has it; delete it again in the admin and it stays deleted. Form responses and images from all folders are merged.

**If the old folders are gone or somewhere else:** add the folders to **`LEGACY_IMPORT_DIRS`** (comma-separated) and redeploy. Or import files downloaded from File Manager, from your computer:

```bash
npm run db:migrate -- --dry-run --from ./backup   # shows what the files contain; writes nothing
npm run db:migrate -- --from ./backup             # imports into the database set in DB_* (safe to repeat)
```

To reach Hostinger's database from your computer, enable **hPanel → Databases → Remote MySQL** for your IP. Then use the remote host shown there as `DB_HOST` in your local `.env`. `--from` accepts an app folder, a `server` folder or a storage folder.

**If something looks wrong after the switch:** nothing is lost, because the old folders are untouched. Removing `DB_NAME` and redeploying returns to file storage, but that starts from an empty folder again. Fixing the database settings and redeploying is better, since the import is safe to repeat.

If the database is briefly unreachable:
- form submissions are appended to `STORAGE_DIR/inquiries.ndjson` and imported on the next start;
- public pages keep showing the announcements shipped with the code (`announcements.seed.json`);
- images shipped with the site still load;
- admin pages show the error.

The error appears in the runtime log.

**Without a database**, data lives in files: `server/storage/announcements.json`, `server/storage/inquiries.ndjson` and `server/media/announcements/`. Set **`STORAGE_DIR`** and **`MEDIA_DIR`** to folders outside the deployment directory (e.g. `/home/<user>/parbon-data/storage` and `/home/<user>/parbon-data/media`) so a redeploy doesn't replace them.

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

**Tests:** `npm test` covers the content API, validation, rate limiting, honeypot, Bengali text persistence, security headers, SEO routes and SPA status codes. The MySQL store tests (`server/test/mysql.test.js`) cover importing old files, preventing duplicates, uploaded images and admin changes. They run when a disposable server is available: `TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD= npm test`. Each run creates and drops its own database.

---

## 12. Extending the site

- **Language switcher:** add a toggle that calls `useLocale().setLocale('bn' | 'en')`. The content already supports it.
- **More content in the database:** announcements, form responses and images already use MySQL when configured (`server/src/db/`). Site content in `server/data/*.json` (events, gallery…) is shipped with the code and doesn't need it. It could move behind the same kind of table plus admin pages later.
- **Admin/CMS:** announcements already have a full admin area (`/admin`). Other content (events, gallery) can follow the same pattern: a storage-backed service, `/api/admin/*` routes protected by `requireAdmin` + `sameOrigin`, and a lazy-loaded admin page.
- **New event:** add an object to `events.json` with a unique `slug`. It automatically appears on `/events`, gets its own page `/events/<slug>`, and is added to the sitemap.
- **Online donations:** integrate a payment gateway (e.g. Razorpay) as a new server route. Keep API keys in environment variables.

---

## Image credits

- **Logo:** © Parbon Sanskritik Samity.
- **Alpana, lal-paar border, arch and icons:** original SVG artwork made for this site.
