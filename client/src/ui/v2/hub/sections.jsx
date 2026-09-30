/* eslint-disable react-refresh/only-export-components -- section component library also exports a small presence hook */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import PronamiPanel from '../../../components/donate/PronamiPanel.jsx';
import { usePronami } from '../../../components/donate/PronamiDialog.jsx';
import Alpana from '../../../components/motifs/Alpana.jsx';
import ArchOutline from '../../../components/motifs/ArchOutline.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import Button from '../../../components/ui/Button.jsx';
import Logo from '../../../components/ui/Logo.jsx';
import { countdownProps } from '../../../components/ui/countdownEvent.js';
import { formatDate, formatDateRange, formatNumber, formatTimeRange, toBengaliDigits } from '../../../i18n/format.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import { useCountdown } from '../../../hooks/useCountdown.js';
import BiTitle from '../BiTitle.jsx';
import BottomSheet from '../BottomSheet.jsx';
import { useSponsor } from '../SponsorSheet.jsx';
import { sponsorHref } from './sponsorLink.js';
import { addDaysIso, dateState, isItemLive, nowNext, selectedScheduleDate } from './timing.js';
import styles from './EventHub.module.css';

const HASH_SECTIONS = [
  ['schedule', { bn: 'নির্ঘণ্ট', en: 'Schedule' }],
  ['passes', { bn: 'পাস', en: 'Passes' }],
  ['sponsor', { bn: 'সহায়তা', en: 'Sponsor' }],
  ['venue', { bn: 'ঠিকানা', en: 'Venue' }],
  ['contact', { bn: 'যোগাযোগ', en: 'Contact' }],
  ['updates', { bn: 'খবর', en: 'Updates' }],
];

const digits = (value) => String(value || '').replace(/\D/g, '');
const STORY_DURATION = 6000;
const COUNTDOWN_UNITS = [
  { key: 'days', en: 'Days', bn: 'দিন' },
  { key: 'hours', en: 'Hours', bn: 'ঘণ্টা' },
  { key: 'minutes', en: 'Minutes', bn: 'মিনিট' },
  { key: 'seconds', en: 'Seconds', bn: 'সেকেন্ড' },
];

function externalProps(href) {
  return href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {};
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function localizeNumber(value, locale) {
  const formatted = formatNumber(value, locale);
  return locale === 'bn' ? toBengaliDigits(formatted) : formatted;
}

function shortText(value = '', max = 130) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function isInternal(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function HubHeading({ id, bn, en, tone = 'default', className = '' }) {
  return <BiTitle id={id} as="h2" size="sm" tone={tone} bn={bn} en={en} className={`${styles.hubHeading} ${className}`} />;
}

function eventUrl(event) {
  if (typeof window === 'undefined') return `/events/${event.slug}`;
  return `${window.location.origin}/events/${event.slug}`;
}

function icsDate(iso) {
  return String(iso || '').replace(/-/g, '');
}

function icsDateTime(date, time) {
  const clean = /^\d{2}:\d{2}$/.test(time || '') ? time : '09:00';
  return `${icsDate(date)}T${clean.replace(':', '')}00`;
}

function icsEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function downloadIcs(event, t) {
  if (!event?.startDate || typeof window === 'undefined') return;
  const allDay = !event.startTime && event.endDate && event.endDate !== event.startDate;
  const start = allDay ? `DTSTART;VALUE=DATE:${icsDate(event.startDate)}` : `DTSTART;TZID=Asia/Kolkata:${icsDateTime(event.startDate, event.startTime)}`;
  const endDate = allDay ? addDaysIso(event.endDate, 1) : event.endDate || event.startDate;
  const end = allDay ? `DTEND;VALUE=DATE:${icsDate(endDate)}` : `DTEND;TZID=Asia/Kolkata:${icsDateTime(endDate, event.endTime || event.startTime)}`;
  const venue = [t(event.venue?.name), t(event.venue?.spot), t(event.venue?.address)].filter(Boolean).join(', ');
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parbon Sanskritik Samity//Event Hub//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kolkata',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.slug}@parbon.in`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    start,
    end,
    `SUMMARY:${icsEscape(event.title?.en || t(event.title))}`,
    `DESCRIPTION:${icsEscape(t(event.summary))}`,
    venue && `LOCATION:${icsEscape(venue)}`,
    `URL:${eventUrl(event)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${event.slug}.ics` });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function EventCover({ event, desktop = false }) {
  const { t } = useLocale();
  const img = event.image?.src;
  const mobileContent = img ? (
    <img src={img} alt={event.image?.alt || ''} width={event.image?.width || undefined} height={event.image?.height || undefined} loading={desktop ? 'eager' : 'lazy'} />
  ) : (
    <div className={styles.coverFallback} aria-hidden="true">
      <Alpana />
    </div>
  );
  const desktopContent = img ? mobileContent : (
    <div className={styles.archLogoWrap}>
      <Logo width={320} sizes="min(18rem, 45vw)" loading="eager" fetchPriority="high" className={styles.archLogo} />
    </div>
  );
  if (desktop) {
    return (
      <div className={styles.archArt}>
        <ArchOutline className={styles.archOutline} />
        <div className={styles.archFrame}>{desktopContent}</div>
      </div>
    );
  }
  return (
    <div className={`${styles.cover} ${img ? '' : styles.coverNoImage}`}>
      {mobileContent}
      {event.category && <span className={styles.categoryPill}>{t(event.category)}</span>}
      <PaarBorder className={styles.paar} />
    </div>
  );
}

export function EventFacts({ event, note }) {
  const { locale, t } = useLocale();
  const when = event.startDate ? formatDateRange(event.startDate, event.endDate, locale) : t(event.dateLabel);
  const time = event.startDate ? formatTimeRange(event.startTime, event.endTime) : '';
  const venueName = t(event.venue?.name);
  const venueArea = [t(event.venue?.spot), t(event.venue?.area)].filter(Boolean).join(' · ');
  return (
    <dl className={styles.facts}>
      {(when || time) && (
        <div className={styles.fact}>
          <dt><Icon name="calendar" size={19} /><span className="visually-hidden">{locale === 'bn' ? 'কবে' : 'When'}</span></dt>
          <dd><strong>{when}</strong>{time && <span>· {time}</span>}</dd>
        </div>
      )}
      {venueName && (
        <div className={styles.fact}>
          <dt><Icon name="pin" size={19} /><span className="visually-hidden">{locale === 'bn' ? 'কোথায়' : 'Where'}</span></dt>
          <dd>
            <span><strong>{venueName}</strong>{venueArea && <> · {venueArea}</>}</span>
            {event.venue?.mapUrl && <a className={styles.factLink} {...externalProps(event.venue.mapUrl)}>{locale === 'bn' ? 'দিকনির্দেশ' : 'Directions'} ↗</a>}
          </dd>
        </div>
      )}
      {note && (
        <div className={styles.fact}>
          <dt><Icon name="check" size={19} /><span className="visually-hidden">{locale === 'bn' ? 'নোট' : 'Note'}</span></dt>
          <dd>{t(note)}</dd>
        </div>
      )}
    </dl>
  );
}

function HubCountdown({ event }) {
  const { locale } = useLocale();
  const props = countdownProps(event, { onEventPage: true });
  const time = useCountdown(props.target);
  if (!time) return null;
  if (time.done) {
    return (
      <p className={styles.countdownDone}>
        <span lang="bn">{props.doneMessage?.bn || 'শুভ শারদীয়া'}</span>
        <span>{props.doneMessage?.en || 'Subho Sharadiya!'}</span>
      </p>
    );
  }
  const label = [props.label?.bn, props.label?.en].filter(Boolean).join(' · ');
  const summary = locale === 'bn'
    ? `${localizeNumber(time.days, locale)} দিন, ${localizeNumber(time.hours, locale)} ঘণ্টা বাকি`
    : `${time.days} days, ${time.hours} hours to go`;
  return (
    <div className={styles.hubCountdown}>
      {label && (
        <p className={styles.countdownLabel}>
          <span>{label}</span>
        </p>
      )}
      <p className="visually-hidden">{summary}</p>
      <ol className={styles.countdownUnits} role="list" aria-hidden="true">
        {COUNTDOWN_UNITS.map((unit) => (
          <li key={unit.key} className={styles.countdownUnit}>
            <strong>{String(localizeNumber(time[unit.key], locale)).padStart(2, locale === 'bn' ? '০' : '0')}</strong>
            <span>{locale === 'bn' ? unit.bn : unit.en}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StatusBlock({ event }) {
  const { locale, t } = useLocale();
  const state = dateState(event);
  if (state === 'before' && event.countdownTo) {
    return (
      <div className={styles.statusBlock}>
        <HubCountdown event={event} />
      </div>
    );
  }
  if (state === 'during') {
    const info = nowNext(event);
    return (
      <div className={`${styles.statusBlock} ${styles.nowBlock}`}>
        <p className={styles.nowEyebrow}>{locale === 'bn' ? 'আজ চলছে' : 'Happening now'}</p>
        {info.mode === 'nowNext' ? (
          <div className={styles.nowGrid}>
            <div><span>{locale === 'bn' ? 'এখন' : 'Now'}</span><strong>{t(info.now?.title)}</strong>{info.now?.time && <small>{info.now.time}</small>}</div>
            {info.next && <div><span>{locale === 'bn' ? 'তারপর' : 'Next'}</span><strong>{t(info.next.title)}</strong>{info.next.time && <small>{info.next.time}</small>}</div>}
          </div>
        ) : info.next ? (
          <div className={styles.nowGrid}><div><span>{locale === 'bn' ? 'পরবর্তী' : 'Next'}</span><strong>{t(info.next.title)}</strong>{info.next.time && <small>{info.next.time}</small>}</div></div>
        ) : (
          <p className={styles.todayText}>{locale === 'bn' ? 'আজকের অনুষ্ঠান চলছে।' : 'Happening today.'}</p>
        )}
      </div>
    );
  }
  if (state === 'after') {
    return (
      <div className={`${styles.statusBlock} ${styles.thanksBlock}`}>
        <p lang="bn">ধন্যবাদ</p>
        <p>{locale === 'bn' ? 'উৎসবে সঙ্গে থাকার জন্য কৃতজ্ঞতা।' : 'Thank you for being part of the celebration.'}</p>
        <div className={styles.inlineLinks}><Link to="/gallery">{locale === 'bn' ? 'ছবি দেখুন' : 'See photos'} →</Link><Link to="/events">{locale === 'bn' ? 'পরের অনুষ্ঠান' : 'Next event'} →</Link></div>
      </div>
    );
  }
  return null;
}

export function ActionBar({ event, couponEvents = [] }) {
  const { locale, t } = useLocale();
  const [shared, setShared] = useState(false);
  const sponsor = useSponsor();
  const hasCoupons = couponEvents.length > 0;
  const during = dateState(event) === 'during';
  const shareText = `${t(event.title)} — ${eventUrl(event)}`;
  const shareHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const primaryIsShare = !hasCoupons && !during && !event.startDate;
  const doShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t(event.title), text: t(event.summary), url: eventUrl(event) }); return; } catch { /* fallback */ }
    }
    if (await copyText(eventUrl(event))) {
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    }
  };
  const primary = hasCoupons
    ? { label: locale === 'bn' ? 'পাস নিন' : 'Get passes', to: couponEvents.length === 1 ? `/register/${couponEvents[0].slug}` : '#passes', icon: 'check' }
    : during && event.venue?.mapUrl
      ? { label: locale === 'bn' ? 'দিকনির্দেশ' : 'Directions', href: event.venue.mapUrl, icon: 'pin' }
      : primaryIsShare
        ? { label: locale === 'bn' ? 'শেয়ার' : 'Share', href: shareHref, icon: 'share', share: true }
        : { label: locale === 'bn' ? 'ক্যালেন্ডারে রাখুন' : 'Add to calendar', onClick: () => downloadIcs(event, t), icon: 'calendar' };
  return (
    <div className={styles.actions}>
      {primary.to?.startsWith('#') ? <a href={primary.to} className={`${styles.bigButton} ${styles.primaryAction}`}><Icon name={primary.icon} size={18} />{primary.label}</a>
        : primary.to ? <Link to={primary.to} className={`${styles.bigButton} ${styles.primaryAction}`}><Icon name={primary.icon} size={18} />{primary.label}</Link>
        : primary.share ? <a className={`${styles.bigButton} ${styles.primaryAction}`} href={primary.href} onClick={(e) => { e.preventDefault(); doShare(); }}><Icon name={shared ? 'check' : primary.icon} size={18} />{shared ? (locale === 'bn' ? 'লিংক কপি' : 'Copied') : primary.label}</a>
        : primary.href ? <a className={`${styles.bigButton} ${styles.primaryAction}`} {...externalProps(primary.href)}><Icon name={primary.icon} size={18} />{primary.label}</a>
        : <button type="button" className={`${styles.bigButton} ${styles.primaryAction}`} onClick={primary.onClick}><Icon name={primary.icon} size={18} />{primary.label}</button>}
      {event.sponsorship?.url ? (
        <a href={sponsorHref(event.slug)} className={`${styles.bigButton} ${styles.secondaryAction}`} onClick={(e) => { e.preventDefault(); sponsor.open(event.slug); }}><Icon name="lamp" size={18} />{t(event.sponsorship.cta) || (locale === 'bn' ? 'স্পনসর করুন' : 'Sponsor')}</a>
      ) : primaryIsShare ? (
        <Link to="/events" className={`${styles.bigButton} ${styles.secondaryAction}`}><Icon name="calendar" size={18} />{locale === 'bn' ? 'সব অনুষ্ঠান' : 'All events'}</Link>
      ) : (
        <a className={`${styles.bigButton} ${styles.secondaryAction}`} href={shareHref} onClick={(e) => { e.preventDefault(); doShare(); }}><Icon name={shared ? 'check' : 'share'} size={18} />{shared ? (locale === 'bn' ? 'লিংক কপি' : 'Copied') : (locale === 'bn' ? 'শেয়ার' : 'Share')}</a>
      )}
      <div className={styles.miniActions}>
        {event.schedule?.length > 0 && <a href="#schedule"><Icon name="calendar" size={18} />{locale === 'bn' ? 'নির্ঘণ্ট' : 'Schedule'}</a>}
        {event.startDate && <button type="button" onClick={() => downloadIcs(event, t)}><Icon name="calendar" size={18} />{locale === 'bn' ? 'ক্যালেন্ডার' : 'Calendar'}</button>}
        <a href={shareHref} onClick={(e) => { e.preventDefault(); doShare(); }}><Icon name="share" size={18} />{locale === 'bn' ? 'শেয়ার' : 'Share'}</a>
      </div>
    </div>
  );
}

export function DayChipsSchedule({ event }) {
  const { locale, t } = useLocale();
  const days = event.schedule || [];
  const [openNote, setOpenNote] = useState(false);
  const defaultSelected = selectedScheduleDate(event);
  const [selected, setSelected] = useState(defaultSelected);
  if (!days.length) return null;
  const currentSelected = days.some((d) => d.date === selected) ? selected : defaultSelected;
  const day = days.find((d) => d.date === currentSelected) || days[0];
  return (
    <section id="schedule" className={styles.section} aria-labelledby="schedule-title">
      <HubHeading id="schedule-title" bn="নির্ঘণ্ট" en="Schedule" />
      <div className={styles.dayChips} role="tablist" aria-label="Schedule days">
        {days.map((d) => (
          <button key={d.date} type="button" className={`${styles.dayChip} ${d.date === day.date ? styles.activeChip : ''}`} onClick={() => setSelected(d.date)}>
            <span>{formatDate(d.date, locale, { day: 'numeric', month: 'short' })}</span>
            <strong>{t(d.day)}</strong>
          </button>
        ))}
      </div>
      <div className={styles.scheduleList}>
        {(day.items || []).map((item, i) => {
          const live = isItemLive(event, item, day.date);
          return (
            <div key={`${item.time}-${i}`} className={`${styles.scheduleRow} ${live ? styles.liveRow : ''}`}>
              <time>{item.time}</time>
              <span>{t(item.title)}</span>
              {live && <em>{locale === 'bn' ? 'চলছে' : 'LIVE'}</em>}
            </div>
          );
        })}
        {!day.items?.length && <p className={styles.muted}>{locale === 'bn' ? 'বিস্তারিত শীঘ্রই।' : 'Details coming soon.'}</p>}
      </div>
      {(event.scheduleNote || day.note) && (
        <div className={styles.scheduleNote}>
          <button type="button" onClick={() => setOpenNote((v) => !v)}>{locale === 'bn' ? 'পুরো নোট দেখুন' : 'Full schedule & notes'} <Icon name="arrow" size={15} /></button>
          {openNote && <p>{t(day.note) || t(event.scheduleNote)}</p>}
        </div>
      )}
    </section>
  );
}

export function PassCards({ couponEvents = [] }) {
  const { locale, t } = useLocale();
  if (!couponEvents.length) return null;
  return (
    <section id="passes" className={styles.section} aria-labelledby="passes-title">
      <HubHeading id="passes-title" bn="আপনার পাস" en="Passes" />
      <div className={styles.passGrid}>
        {couponEvents.map((event) => (
          <article key={event.slug} className={styles.passCard}>
            <div className={styles.passStub}>{event.startsAt ? <><strong>{formatDate(event.startsAt.slice(0, 10), 'en', { day: 'numeric' })}</strong><span>{formatDate(event.startsAt.slice(0, 10), 'en', { month: 'short' })}</span></> : <span>{locale === 'bn' ? 'পাস' : 'Pass'}</span>}</div>
            <div className={styles.passBody}>
              <h3>{t(event.title)}</h3>
              <p>{t(event.tagline) || (locale === 'bn' ? 'নিবন্ধন খোলা আছে' : 'Registration is open')}</p>
              <Link to={`/register/${event.slug}`} className={styles.passGet}>{locale === 'bn' ? 'নিন' : 'Get'} →</Link>
            </div>
          </article>
        ))}
      </div>
      <Link to="/passes" className={styles.textLink}>{locale === 'bn' ? 'আমার পাস' : 'My passes'} →</Link>
    </section>
  );
}

export function SponsorBand({ event }) {
  const { locale, t } = useLocale();
  const { open: openPronami } = usePronami();
  const sponsorSheet = useSponsor();
  const sectionRef = useRef(null);
  const sponsor = event.sponsorship;
  useEffect(() => {
    if (!sponsor?.url) return undefined;
    const node = sectionRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        sponsorSheet.warmSponsor();
        observer.disconnect();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [sponsor?.url, sponsorSheet]);
  if (!sponsor?.url && !sponsor?.appeal && !sponsor?.highlights?.length) return null;
  return (
    <section ref={sectionRef} id="sponsor" className={`${styles.section} ${styles.sponsorBand}`} aria-labelledby="sponsor-title">
      <div className={styles.sponsorMain}>
        <HubHeading id="sponsor-title" bn="পুজোর পাশে থাকুন" en="Sponsor this event" tone="gold" />
        {sponsor.appeal && <p className={styles.sponsorAppeal}>{t(sponsor.appeal)}</p>}
        {sponsor.highlights?.length > 0 && (
          <div className={styles.sponsorTiles}>
            {sponsor.highlights.slice(0, 4).map((h) => (
              <div key={`${h.name?.en}-${h.amount}`} className={styles.sponsorTile}>
                <strong>{t(h.name)}</strong>
                {h.amount != null && <span>₹{localizeNumber(h.amount, locale)}</span>}
                {h.shareable && <small>{locale === 'bn' ? 'ভাগ করে দেওয়া যায়' : 'shareable'}</small>}
              </div>
            ))}
          </div>
        )}
        <div className={styles.sponsorActions}>
          <a href={sponsorHref(event.slug)} className={`${styles.bigButton} ${styles.goldAction}`} onClick={(e) => { e.preventDefault(); sponsorSheet.open(event.slug); }}>{t(sponsor.cta) || (locale === 'bn' ? 'যে কোনো অর্ঘ্য স্পনসর করুন' : 'Sponsor an item or any amount')}</a>
          <button type="button" className={styles.pronamiLink} onClick={openPronami}>{locale === 'bn' ? 'অথবা ইউপিআই প্রণামী দিন' : 'or offer a quick pronami by UPI'}</button>
        </div>
      </div>
      <div className={styles.pronamiDesktop}><PronamiPanel tone="dark" showIntro={false} /></div>
    </section>
  );
}

export function VenueSection({ event }) {
  const { locale, t } = useLocale();
  const [copied, setCopied] = useState(false);
  const venue = event.venue;
  if (!venue?.name) return null;
  const address = t(venue.address) || [t(venue.spot), t(venue.area)].filter(Boolean).join(', ');
  return (
    <section id="venue" className={styles.section} aria-labelledby="venue-title">
      <HubHeading id="venue-title" bn="ঠিকানা" en="Venue" />
      <div className={styles.venueGrid}>
        <div className={styles.staticMap} aria-hidden="true"><Alpana /><Icon name="pin" size={38} /></div>
        <div className={styles.venueCard}>
          <h3>{t(venue.name)}</h3>
          {venue.spot && <p>{t(venue.spot)}</p>}
          {address && <address>{address}</address>}
          <div className={styles.inlineLinks}>
            {venue.mapUrl && <a {...externalProps(venue.mapUrl)}>{locale === 'bn' ? 'দিকনির্দেশ' : 'Directions'} ↗</a>}
            {address && <button type="button" onClick={async () => { if (await copyText(address)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); } }}><Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? (locale === 'bn' ? 'কপি হয়েছে' : 'Copied') : (locale === 'bn' ? 'ঠিকানা কপি' : 'Copy address')}</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Highlights({ event }) {
  const { t } = useLocale();
  if (!event.highlights?.length) return null;
  return (
    <section id="highlights" className={styles.section} aria-labelledby="highlights-title">
      <HubHeading id="highlights-title" bn="যা থাকছে" en="Highlights" />
      <div className={styles.highlightGrid}>
        {event.highlights.map((h) => (
          <article key={`${h.icon}-${h.title?.en}`} className={styles.highlightCard}>
            <Icon name={h.icon || 'lotus'} size={24} />
            <h3>{t(h.title)}</h3>
            {h.text && <p>{t(h.text)}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ComingUp({ events = [], currentSlug }) {
  const { locale, t } = useLocale();
  const list = events.filter((e) => e.slug !== currentSlug && e.status !== 'past').slice(0, 6);
  if (!list.length) return null;
  return (
    <section id="coming-up" className={styles.section} aria-labelledby="coming-title">
      <HubHeading id="coming-title" bn="আরও যা আসছে" en="Coming up" />
      <div className={styles.comingRail}>
        {list.map((e) => (
          <Link key={e.slug} to={`/events/${e.slug}`} className={styles.comingCard}>
            <span className={styles.dateBlock}>{e.startDate ? <><strong>{formatDate(e.startDate, 'en', { day: 'numeric' })}</strong><small>{formatDate(e.startDate, 'en', { month: 'short' })}</small></> : <><strong>{locale === 'bn' ? 'শীঘ্র' : 'Soon'}</strong></>}</span>
            <span><b>{t(e.title)}</b><small>{e.startDate ? formatDateRange(e.startDate, e.endDate, locale) : t(e.dateLabel)}</small></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function EventContacts({ event, site }) {
  const { locale, t } = useLocale();
  const contacts = event.contacts?.length ? event.contacts : site?.contact?.people || [];
  const community = site?.contact?.whatsappCommunity;
  const message = encodeURIComponent(`Hi, about ${event.title?.en || 'Parbon event'}…`);
  const visibleContacts = contacts.slice(0, 3);
  if (!visibleContacts.length && !community) return null;
  return (
    <section id="contact" className={styles.section} aria-labelledby="contact-title">
      <HubHeading id="contact-title" bn="যোগাযোগ" en="Contact" />
      <div className={styles.contactList}>
        {community && <a className={`${styles.contactRow} ${styles.communityRow}`} {...externalProps(community)}><Icon name="whatsapp" size={24} /><span><strong>{locale === 'bn' ? 'হোয়াটসঅ্যাপ কমিউনিটি' : 'WhatsApp community'}</strong><small>{locale === 'bn' ? 'সর্বশেষ খবর পেতে যোগ দিন' : 'Join for event updates'}</small></span></a>}
        {visibleContacts.map((c) => {
          const wa = digits(c.whatsapp || c.phone);
          const phone = digits(c.phone || c.whatsapp);
          return (
            <div key={`${c.name}-${wa}-${phone}`} className={styles.contactRow}>
              <span className={styles.initials}>{String(c.name || 'P').slice(0, 1)}</span>
              <span><strong>{c.name}</strong>{c.role && <small>{t(c.role)}</small>}</span>
              <span className={styles.contactActions}>{phone && <a href={`tel:${phone}`}><Icon name="phone" size={17} />{locale === 'bn' ? 'কল' : 'Call'}</a>}{wa && <a {...externalProps(`https://wa.me/${wa}?text=${message}`)}><Icon name="whatsapp" size={17} />WhatsApp</a>}</span>
            </div>
          );
        })}
      </div>
      <Button to="/contact" variant="secondary">{locale === 'bn' ? 'সব যোগাযোগ' : 'All contacts'} →</Button>
    </section>
  );
}

function StoryViewer({ announcements, index, seen, onSeen, onClose, onIndex }) {
  const { t } = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const [progressState, setProgressState] = useState({ index, value: 0 });
  const [paused, setPaused] = useState(false);
  const active = index >= 0 ? announcements[index] : null;
  const startX = useRef(null);
  const progress = progressState.index === index ? progressState.value : 0;

  const go = useCallback((delta) => {
    if (!announcements.length) return;
    onIndex((index + delta + announcements.length) % announcements.length);
  }, [announcements.length, index, onIndex]);

  useEffect(() => {
    if (!active) return;
    onSeen(active.slug);
  }, [active, onSeen]);

  useEffect(() => {
    if (!active || paused || reducedMotion) return undefined;
    const started = Date.now() - progress * STORY_DURATION;
    const id = window.setInterval(() => {
      const next = Math.min(1, (Date.now() - started) / STORY_DURATION);
      setProgressState({ index, value: next });
      if (next >= 1) go(1);
    }, 100);
    return () => window.clearInterval(id);
  }, [active, go, index, paused, progress, reducedMotion]);

  if (!active) return null;

  const title = t(active.title);
  const text = shortText(t(active.body) || active.body?.en || active.body?.bn || '');
  const readMore = `/announcements/${active.slug}`;
  const renderReadMore = isInternal(readMore)
    ? <Link to={readMore} className={styles.storyRead}>{t({ en: 'Read more', bn: 'আরও পড়ুন' })} →</Link>
    : <a href={readMore} className={styles.storyRead}>{t({ en: 'Read more', bn: 'আরও পড়ুন' })} →</a>;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={title}
      historyKey="updates"
      className={styles.storyDialog}
      contentClassName={styles.storyContent}
    >
      <div
        className={styles.storyStage}
        onPointerDown={(event) => { setPaused(true); startX.current = event.clientX; }}
        onPointerUp={(event) => {
          setPaused(false);
          const delta = startX.current == null ? 0 : event.clientX - startX.current;
          if (Math.abs(delta) > 60) go(delta < 0 ? 1 : -1);
          startX.current = null;
        }}
        onPointerCancel={() => { setPaused(false); startX.current = null; }}
      >
        <div className={styles.storyProgress} aria-hidden="true">
          {announcements.map((a, i) => (
            <span key={a.slug} className={seen.has(a.slug) || i <= index ? styles.storyProgressSeen : ''}>
              <i style={i === index ? { transform: `scaleX(${progress})` } : undefined} />
            </span>
          ))}
        </div>
        {active.image?.src ? (
          <img className={styles.storyImage} src={active.image.src} alt={active.image.alt || ''} />
        ) : (
          <div className={styles.storyFallback}><Icon name="megaphone" size={48} /></div>
        )}
        <button type="button" className={`${styles.storyTap} ${styles.storyPrev}`} aria-label="Previous update" onClick={() => go(-1)} />
        <button type="button" className={`${styles.storyTap} ${styles.storyNext}`} aria-label="Next update" onClick={() => go(1)} />
        <div className={styles.storyCopy}>
          <h3>{title}</h3>
          {text && <p>{text}</p>}
          {renderReadMore}
        </div>
      </div>
    </BottomSheet>
  );
}

export function UpdateBubbles({ announcements = [] }) {
  const { t } = useLocale();
  const [seen, setSeen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('parbon.seenUpdates') || '[]')); } catch { return new Set(); }
  });
  const [openIndex, setOpenIndex] = useState(-1);
  const mark = useCallback((slug) => {
    setSeen((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Set(prev).add(slug);
      try { localStorage.setItem('parbon.seenUpdates', JSON.stringify([...next].slice(-80))); } catch { /* ignore */ }
      return next;
    });
  }, []);
  if (!announcements.length) return null;
  return (
    <>
      <section id="updates" className={styles.updateBubbles} aria-label="Latest updates">
        {announcements.slice(0, 8).map((a, i) => (
          <button key={a.slug} type="button" className={styles.updateBubble} aria-label={t(a.title)} title={t(a.title)} onClick={() => setOpenIndex(i)}>
            <span className={`${styles.updateRing} ${seen.has(a.slug) ? styles.seenRing : ''}`}>{a.image?.src ? <img src={a.image.src} alt="" loading="lazy" /> : <Icon name="megaphone" size={26} />}</span>
            <span>{t(a.title)}</span>
          </button>
        ))}
      </section>
      <StoryViewer announcements={announcements.slice(0, 8)} index={openIndex} seen={seen} onSeen={mark} onClose={() => setOpenIndex(-1)} onIndex={setOpenIndex} />
    </>
  );
}

export function SectionNav({ sections }) {
  const { t } = useLocale();
  const [active, setActive] = useState(sections[0]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id);
    }, { rootMargin: '-30% 0px -60% 0px', threshold: [0.1, 0.4, 0.8] });
    sections.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [sections]);
  if (sections.length < 2) return null;
  return (
    <nav className={styles.sectionNav} aria-label="Event sections">
      {HASH_SECTIONS.filter(([id]) => sections.includes(id)).map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? styles.activeNav : ''}>{t(label)}</a>)}
    </nav>
  );
}

export function usePresentSections({ event, couponEvents, site, announcements }) {
  return useMemo(() => HASH_SECTIONS.map(([id]) => id).filter((id) => {
    if (id === 'schedule') return event.schedule?.length;
    if (id === 'passes') return couponEvents?.length;
    if (id === 'sponsor') return event.sponsorship?.url || event.sponsorship?.appeal || event.sponsorship?.highlights?.length;
    if (id === 'venue') return event.venue?.name;
    if (id === 'contact') return event.contacts?.length || site?.contact?.people?.length || site?.contact?.whatsappCommunity || site?.contact?.email;
    if (id === 'updates') return announcements?.length;
    return false;
  }), [event, couponEvents, site, announcements]);
}
