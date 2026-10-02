import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// File store (no database): the same rules apply as with MySQL.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-events-'));
const PASSWORD = 'durga-maa-ki-joi-2026';
const salt = randomBytes(16);
const hash = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
Object.assign(process.env, {
  STORAGE_DIR: path.join(tmp, 'storage'),
  MEDIA_DIR: path.join(tmp, 'media'),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SITE_URL: 'https://parbon.example',
  SMTP_HOST: '',
  DB_NAME: '',
  DB_USER: '',
});

const { createApp } = await import('../src/app.js');
const { validateEvent } = await import('../src/utils/validateEvent.js');
const { eventTiming, sortEvents } = await import('../src/services/eventService.js');

let server;
let base;
let cookie;
const call = async (p, { method = 'GET', body, auth = false } = {}) => {
  const res = await fetch(`${base}/api${p}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Cookie: cookie } : {}), Origin: base },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json();
  return { status: res.status, data: json?.data, error: json?.error, headers: res.headers };
};
const admin = (p, opts = {}) => call(`/admin${p}`, { ...opts, auth: true });

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: PASSWORD } });
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const day = (offset) => new Date(Date.now() + 5.5 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
const basic = (over = {}) => ({ title: { en: 'Community Picnic', bn: 'বনভোজন' }, summary: { en: 'A day out together.' }, startDate: day(10), ...over });

describe('event validation', () => {
  it('cleans a full event and drops empty optional parts', () => {
    const { value, errors } = validateEvent(
      basic({
        category: { en: '', bn: '' },
        startTime: '10:00',
        endTime: '16:30',
        venue: { name: { en: 'Botanical Garden' }, mapUrl: 'https://maps.app.goo.gl/x', geo: '17.4829, 78.3202' },
        description: [{ en: 'Bring a mat.' }, { en: '', bn: '' }],
        highlights: [{ icon: 'evil', title: { en: 'Games' } }, { title: { en: '' } }],
        schedule: [{ day: { en: 'Picnic day' }, date: day(10), items: [{ time: '10:00 AM', title: { en: 'Arrive' } }, { time: '' }] }],
      }),
    );
    assert.equal(errors, undefined);
    assert.equal(value.slug, 'community-picnic');
    assert.equal(value.state, 'draft');
    assert.equal(value.category, null);
    assert.equal(value.endDate, value.startDate);
    assert.equal(value.venue.spot, null);
    assert.equal(value.venue.mapEmbedUrl, 'https://maps.google.com/maps?q=17.4829,78.3202&z=17&output=embed');
    assert.deepEqual(value.description, [{ en: 'Bring a mat.', bn: '' }]);
    assert.equal(value.highlights.length, 1);
    assert.equal(value.highlights[0].icon, 'lotus', 'unknown icons fall back to a safe one');
    assert.equal(value.schedule[0].items.length, 1);
  });

  it('supports "date to be announced" and rejects impossible dates, times and links', () => {
    const tba = validateEvent(basic({ startDate: '', dateTba: true }));
    assert.equal(tba.value.startDate, null);
    assert.equal(tba.value.dateLabel.en, 'Date to be announced');

    const bad = validateEvent(
      basic({ startDate: '2026-02-30', endTime: '25:00', venue: { name: { en: 'X' }, mapUrl: 'javascript:alert(1)', geo: 'nowhere' }, image: { src: 'https://evil.example/x.png' } }),
    );
    for (const field of ['startDate', 'endTime', 'venue.mapUrl', 'venue.geo', 'image.src']) assert.ok(bad.errors[field], field);
    assert.ok(validateEvent(basic({ endDate: day(5) })).errors.endDate, 'end before start');
    assert.ok(validateEvent(basic({ startTime: '19:00', endTime: '17:00' })).errors.endTime);
    assert.ok(validateEvent({ title: { en: 'No summary' }, startDate: day(1) }).errors['summary.en']);
  });

  it('accepts the seed events shipped with the site', async () => {
    const { readFile } = await import('node:fs/promises');
    const { events } = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
    for (const e of events) assert.equal(validateEvent(e).errors, undefined, e.slug);
  });
});

describe('event timing and order', () => {
  const now = Date.parse('2026-10-02T12:00:00+05:30');
  const ev = (slug, startDate, endDate, extra = {}) => ({ slug, title: { en: slug }, startDate, endDate, ...extra });

  it('works out upcoming, happening now, past and to-be-announced in India time', () => {
    assert.equal(eventTiming(ev('today-later', '2026-10-02', '2026-10-02', { startTime: '17:00', endTime: '19:00' }), now), 'upcoming');
    assert.equal(eventTiming(ev('this-morning', '2026-10-02', '2026-10-02', { startTime: '08:00', endTime: '10:00' }), now), 'past');
    assert.equal(eventTiming(ev('all-day-today', '2026-10-02', '2026-10-02'), now), 'upcoming', 'an all-day event lasts until midnight');
    assert.equal(eventTiming(ev('yesterday', '2026-10-01', '2026-10-01'), now), 'past');
    assert.equal(eventTiming(ev('tba', null, null), now), 'planned');
  });

  it('puts the soonest upcoming first, then to-be-announced, then the most recent past', () => {
    const list = [
      ev('past-old', '2026-01-10', '2026-01-10'),
      ev('puja', '2026-10-16', '2026-10-21'),
      ev('tba', null, null),
      ev('meet', '2026-10-02', '2026-10-02', { startTime: '17:00' }),
      ev('past-recent', '2026-09-20', '2026-09-20'),
      ev('bijoya', '2026-10-25', '2026-10-25'),
    ];
    assert.deepEqual(sortEvents(list, now).map((e) => e.slug), ['meet', 'puja', 'bijoya', 'tba', 'past-recent', 'past-old']);
  });
});

describe('events API', () => {
  it('shows the seed events, hides the Meet & Greet draft, and sorts chronologically', async () => {
    const list = (await call('/events')).data;
    const slugs = list.map((e) => e.slug);
    assert.ok(slugs.includes('durga-puja-2026') && slugs.includes('bijoya-sammilani-2026'));
    assert.ok(!slugs.includes('meet-and-greet-2026'), 'drafts are not public');
    assert.equal((await call('/events/meet-and-greet-2026')).status, 404);
    assert.equal(list.find((e) => e.slug === 'bijoya-sammilani-2026').status, 'planned');
    assert.equal(list[0].schedule, undefined, 'list pages get summaries');
    assert.equal((await call('/events/durga-puja-2026')).data.schedule.length > 0, true);
    assert.equal((await call('/events/durga-puja-2026')).data.seedRevision, undefined, 'seed bookkeeping is not stored');

    const all = (await admin('/events')).data;
    const meet = all.find((e) => e.slug === 'meet-and-greet-2026');
    assert.equal(meet.state, 'draft');
    assert.equal(meet.startTime, '17:00');
  });

  it('lets the admin create a draft, publish it, and schedules future publishing', async () => {
    const created = await admin('/events', { method: 'POST', body: basic() });
    assert.equal(created.status, 201);
    assert.equal(created.data.state, 'draft');
    assert.equal((await call('/events/community-picnic')).status, 404);

    const published = await admin(`/events/${created.data.id}`, { method: 'PUT', body: { ...created.data, state: 'published', publishedAt: '' } });
    assert.equal(published.data.state, 'published');
    assert.equal((await call('/events/community-picnic')).data.status, 'upcoming');

    const later = await admin('/events', { method: 'POST', body: basic({ title: { en: 'Winter Fair' }, state: 'published', publishedAt: new Date(Date.now() + 86400_000).toISOString() }) });
    assert.equal((await call(`/events/${later.data.slug}`)).status, 404, 'scheduled events wait for their publish time');
  });

  it('locks the link name once published, and orders the public list by date', async () => {
    const all = (await admin('/events')).data;
    const picnic = all.find((e) => e.slug === 'community-picnic');
    const renamed = await admin(`/events/${picnic.id}`, { method: 'PUT', body: { ...picnic, slug: 'new-name' } });
    assert.equal(renamed.status, 422);
    assert.ok(renamed.error.fields.slug);

    // A past and a near event: the near one comes first, the past one last.
    await admin('/events', { method: 'POST', body: basic({ title: { en: 'Last Year Fair' }, startDate: '2025-12-01', state: 'published' }) });
    await admin('/events', { method: 'POST', body: basic({ title: { en: 'Tomorrow Adda' }, startDate: day(1), state: 'published' }) });
    const slugs = (await call('/events')).data.map((e) => e.slug);
    assert.equal(slugs[0], 'tomorrow-adda');
    assert.equal(slugs.at(-1), 'last-year-fair');
    const statuses = (await call('/events')).data.map((e) => e.status);
    assert.deepEqual(statuses, [...statuses].sort((a, b) => ['upcoming', 'planned', 'past'].indexOf(a) - ['upcoming', 'planned', 'past'].indexOf(b)));
  });

  it('keeps editing admin-only and validates input', async () => {
    assert.equal((await call('/admin/events')).status, 401);
    assert.equal((await call('/admin/events', { method: 'POST', body: basic() })).status, 401);
    const bad = await admin('/events', { method: 'POST', body: { title: { en: 'x' } } });
    assert.equal(bad.status, 422);
    const all = (await admin('/events')).data;
    const picnic = all.find((e) => e.slug === 'community-picnic');
    assert.equal((await admin(`/events/${picnic.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await call('/events/community-picnic')).status, 404);
  });

  it('lists only published events in the sitemap', async () => {
    const xml = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.match(xml, /events\/durga-puja-2026/);
    assert.doesNotMatch(xml, /meet-and-greet-2026/);
  });
});

describe('event countdown timer', () => {
  it('validates the countdown and stores it without the form-only switch', () => {
    const on = validateEvent(basic({ countdown: { enabled: true, date: day(10), time: '', label: { en: 'Picnic in', bn: '' }, doneMessage: { en: '', bn: '' } } }));
    assert.deepEqual(on.value.countdown, { date: day(10), time: '00:00', label: { en: 'Picnic in', bn: '' }, doneMessage: null });
    assert.equal(validateEvent(basic({ countdown: { enabled: false, date: day(10) } })).value.countdown, null);
    assert.equal(validateEvent(basic()).value.countdown, null);
    // A stored event (as sent back by the admin list's Publish button) keeps its countdown.
    assert.equal(validateEvent(basic({ countdown: on.value.countdown })).value.countdown.date, day(10));
    const bad = validateEvent(basic({ countdown: { enabled: true, date: '', time: '25:00' } })).errors;
    assert.ok(bad['countdown.date'] && bad['countdown.time']);
  });

  it('gives Durga Puja its Bodhon countdown and lets the admin switch timers on and off', async () => {
    const puja = (await call('/events')).data.find((e) => e.slug === 'durga-puja-2026');
    assert.equal(puja.countdownTo, '2026-10-16T18:00:00+05:30');
    assert.equal(puja.countdown.label.en, 'Maa arrives in');

    const created = await admin('/events', {
      method: 'POST',
      body: basic({ title: { en: 'Timer Test' }, state: 'published', countdown: { enabled: true, date: day(10), time: '18:30' } }),
    });
    assert.equal(created.status, 201);
    assert.equal((await call('/events/timer-test')).data.countdownTo, `${day(10)}T18:30:00+05:30`);

    // Round trip through the admin (the payload includes the computed countdownTo, which isn't stored).
    const off = await admin(`/events/${created.data.id}`, { method: 'PUT', body: { ...created.data, countdown: { ...created.data.countdown, enabled: false } } });
    assert.equal(off.data.countdown, null);
    assert.equal((await call('/events/timer-test')).data.countdownTo, null);
    assert.equal((await admin(`/events/${created.data.id}`, { method: 'DELETE' })).status, 204);
  });
});
