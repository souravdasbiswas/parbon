import { Link } from 'react-router';
import Alpana from '../../../components/motifs/Alpana.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { events as eventsCopy } from '../../../content/pages.js';
import { useApi } from '../../../hooks/useApi.js';
import { formatDate, formatDateRange, formatTimeRange } from '../../../i18n/format.js';
import { contentApi, couponsApi } from '../../../services/api.js';
import BiTitle, { useT } from '../BiTitle.jsx';
import { useSponsor } from '../SponsorSheet.jsx';
import styles from './EventsPage.module.css';

function icsDate(iso) {
  return String(iso || '').replace(/-/g, '');
}

function icsDateTime(date, time) {
  const clean = /^\d{2}:\d{2}$/.test(time || '') ? time : '09:00';
  return `${icsDate(date)}T${clean.replace(':', '')}00`;
}

function addDaysIso(iso, days) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function downloadIcs(event, t) {
  if (!event?.startDate) return;
  const allDay = !event.startTime && event.endDate && event.endDate !== event.startDate;
  const start = allDay ? `DTSTART;VALUE=DATE:${icsDate(event.startDate)}` : `DTSTART;TZID=Asia/Kolkata:${icsDateTime(event.startDate, event.startTime)}`;
  const endDate = allDay ? addDaysIso(event.endDate, 1) : event.endDate || event.startDate;
  const end = allDay ? `DTEND;VALUE=DATE:${icsDate(endDate)}` : `DTEND;TZID=Asia/Kolkata:${icsDateTime(endDate, event.endTime || event.startTime)}`;
  const venue = [t(event.venue?.name), t(event.venue?.spot), t(event.venue?.address)].filter(Boolean).join(', ');
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parbon Sanskritik Samity//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.slug}@parbon.in`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    start,
    end,
    `SUMMARY:${escapeIcs(event.title?.en || t(event.title))}`,
    `DESCRIPTION:${escapeIcs(t(event.summary))}`,
    venue && `LOCATION:${escapeIcs(venue)}`,
    typeof window !== 'undefined' && `URL:${window.location.origin}/events/${event.slug}`,
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

function DateBadge({ event }) {
  const { locale, date } = useT();
  if (!event.startDate) {
    return (
      <span className={`${styles.dateBadge} ${styles.tba}`} aria-label="Date to be announced">
        <small>TBA</small>
        <b>{locale === 'bn' ? 'শীঘ্রই' : 'Soon'}</b>
      </span>
    );
  }
  return (
    <time className={styles.dateBadge} dateTime={event.startDate}>
      <small>{formatDate(event.startDate, 'en', { month: 'short' }).toUpperCase()}</small>
      <b>{date(event.startDate, { day: 'numeric' })}</b>
    </time>
  );
}

function whenText(event, locale, t) {
  if (!event.startDate) return t(event.dateLabel) || (locale === 'bn' ? 'তারিখ শীঘ্রই' : 'Date to be announced');
  const when = formatDateRange(event.startDate, event.endDate, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = formatTimeRange(event.startTime, event.endTime);
  return time ? `${when} · ${time}` : when;
}

function venueText(event, t) {
  return [t(event.venue?.name), t(event.venue?.spot), t(event.venue?.area)].filter(Boolean).join(' · ');
}

function matchPassEvent(event, openPassEvents) {
  return (openPassEvents || []).find((open) => open.linkedEventSlug === event.slug || open.slug === event.slug);
}

function EventCard({ event, openPassEvents }) {
  const { locale, t } = useT();
  const sponsor = useSponsor();
  const passEvent = matchPassEvent(event, openPassEvents);
  const venue = venueText(event, t);
  const actions = [];
  if (passEvent) {
    actions.push(
      <Button key="passes" to={`/register/${passEvent.slug}`} size="sm" className={styles.primaryAction}>
        {locale === 'bn' ? 'পাস নিন' : 'Get passes'}
      </Button>,
    );
  }
  if (event.sponsorship?.url) {
    actions.push(
      <button key="sponsor" type="button" className={styles.goldAction} onClick={() => sponsor.open(event.slug)} onMouseEnter={sponsor.warmSponsor} onFocus={sponsor.warmSponsor}>
        <Icon name="lamp" size={17} /> {locale === 'bn' ? 'সহায়তা' : 'Sponsor'}
      </button>,
    );
  }
  if (actions.length === 0) {
    if (event.startDate) {
      actions.push(
        <button key="calendar" type="button" className={styles.softAction} onClick={() => downloadIcs(event, t)}>
          <Icon name="calendar" size={17} /> {locale === 'bn' ? 'ক্যালেন্ডার' : 'Add to calendar'}
        </button>,
      );
    }
    if (event.venue?.mapUrl) {
      actions.push(
        <a key="directions" className={styles.softAction} href={event.venue.mapUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="pin" size={17} /> {locale === 'bn' ? 'দিকনির্দেশ' : 'Directions'}
        </a>,
      );
    }
  }

  return (
    <article className={`${styles.card} ${event.featured ? styles.featured : ''}`}>
      <Link to={`/events/${event.slug}`} className={styles.cardLink} aria-label={`${t(event.title)} details`}>
        <div className={styles.cover}>
          {event.image?.src ? <img src={event.image.src} alt={event.image.alt || ''} loading="lazy" decoding="async" /> : <Alpana className={styles.fallbackArt} />}
          <DateBadge event={event} />
          {event.featured && <span className={styles.featuredPill}>{locale === 'bn' ? 'বিশেষ' : 'Featured'}</span>}
          <PaarBorder className={styles.paar} />
        </div>
        <div className={styles.cardBody}>
          {event.category && <p className={styles.kicker}>{t(event.category)}</p>}
          <h2 className={styles.eventTitle}>
            {event.title?.bn && <span lang="bn">{event.title.bn}</span>}
            <em>{event.title?.en}</em>
          </h2>
          <p className={styles.fact}><Icon name="calendar" size={17} /> {whenText(event, locale, t)}</p>
          {venue && <p className={styles.fact}><Icon name="pin" size={17} /> {venue}</p>}
          {event.summary && <p className={styles.summary}>{t(event.summary)}</p>}
        </div>
      </Link>
      {actions.length > 0 && <div className={styles.actions}>{actions.slice(0, 2)}</div>}
    </article>
  );
}

function PastList({ events }) {
  const { locale, t } = useT();
  if (!events.length) return null;
  return (
    <ul className={styles.pastList} role="list">
      {events.map((event) => (
        <li key={event.slug}>
          <Link to={`/events/${event.slug}`}>
            <time>{event.startDate ? formatDate(event.startDate, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : t(event.dateLabel)}</time>
            <span>{t(event.title)}</span>
            <Icon name="arrow" size={18} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function EventsPage() {
  const { t } = useT();
  const events = useApi('events', () => contentApi.events());
  const openPasses = useApi('coupon-events:open:v2-events', () => couponsApi.openEvents());
  const list = events.data || [];
  const upcoming = list.filter((e) => e.status === 'upcoming');
  const planned = list.filter((e) => e.status === 'planned');
  const past = list.filter((e) => e.status === 'past');

  return (
    <>
      <Seo title="Events" description="Upcoming, planned and past celebrations from Parbon Sanskritik Samity." />
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>{t(eventsCopy.hero.eyebrow)}</p>
          <BiTitle bn={eventsCopy.hero.title.bn} en={eventsCopy.hero.title.en} />
          <p className={styles.intro}>{t(eventsCopy.hero.intro)}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="upcoming-title">
        <div className="container">
          <BiTitle id="upcoming-title" as="h2" size="md" bn={eventsCopy.upcoming.title.bn} en={eventsCopy.upcoming.title.en} />
          {events.loading && <LoadingState lines={5} />}
          {events.error && <ErrorState error={events.error} onRetry={events.retry} />}
          {!events.loading && !events.error && upcoming.length === 0 && <EmptyState title={{ bn: 'শীঘ্রই জানাব', en: 'No upcoming events yet' }} text={{ en: 'The next celebration will appear here as soon as it is announced.', bn: 'পরের অনুষ্ঠান ঘোষণা হলেই এখানে দেখা যাবে।' }} />}
          <div className={styles.grid}>
            {upcoming.map((event) => <EventCard key={event.slug} event={event} openPassEvents={openPasses.data || []} />)}
          </div>
        </div>
      </section>

      {planned.length > 0 && (
        <section className={`${styles.section} ${styles.tint}`} aria-labelledby="planned-title">
          <div className="container">
            <BiTitle id="planned-title" as="h2" size="md" bn={eventsCopy.planned.title.bn} en={eventsCopy.planned.title.en} />
            <p className={styles.sectionIntro}>{t(eventsCopy.planned.text)}</p>
            <div className={styles.grid}>
              {planned.map((event) => <EventCard key={event.slug} event={event} openPassEvents={openPasses.data || []} />)}
            </div>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className={styles.section} aria-labelledby="past-title">
          <div className="container">
            <BiTitle id="past-title" as="h2" size="md" bn="ফেলে আসা দিন" en="Past celebrations" />
            <PastList events={past} />
          </div>
        </section>
      )}
    </>
  );
}

