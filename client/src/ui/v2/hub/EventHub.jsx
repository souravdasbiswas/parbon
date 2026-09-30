import { useParams } from 'react-router';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { useApi } from '../../../hooks/useApi.js';
import { useScrollToHash } from '../../../hooks/useScrollToHash.js';
import { announcementsApi, contentApi, couponsApi } from '../../../services/api.js';
import NotFound from '../../../pages/NotFound.jsx';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import BiTitle from '../BiTitle.jsx';
import {
  ActionBar,
  ComingUp,
  DayChipsSchedule,
  EventContacts,
  EventCover,
  EventFacts,
  Highlights,
  PassCards,
  SectionNav,
  SponsorBand,
  UpdateBubbles,
  usePresentSections,
  VenueSection,
  StatusBlock,
} from './sections.jsx';
import styles from './EventHub.module.css';

function asDateTime(date, time) {
  if (!date) return undefined;
  if (/^\d{2}:\d{2}$/.test(time || '')) return `${date}T${time}:00+05:30`;
  return date;
}

function EventJsonLd({ event }) {
  const v = event.venue;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${event.title?.en || 'Parbon event'} — Parbon Sanskritik Samity`,
    alternateName: event.title?.bn,
    description: event.summary?.en || event.summary?.bn,
    startDate: asDateTime(event.startDate, event.startTime),
    endDate: asDateTime(event.endDate || event.startDate, event.endTime),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: event.image?.src,
    organizer: { '@type': 'Organization', name: 'Parbon Sanskritik Samity', url: 'https://parbon.in' },
    ...(v?.name && {
      location: {
        '@type': 'Place',
        name: v.name.en || v.name.bn,
        address: v.address?.en || v.address?.bn,
        ...(v.geo && { geo: { '@type': 'GeoCoordinates', latitude: v.geo.lat, longitude: v.geo.lng } }),
        ...(v.mapUrl && { hasMap: v.mapUrl }),
      },
    }),
  };
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}

function Hero({ event, couponEvents }) {
  const { t } = useLocale();
  return (
    <section className={styles.hero} aria-labelledby="event-title">
      <div className={styles.heroAlpana} aria-hidden="true" />
      <div className={`container ${styles.heroGrid}`}>
        <article className={styles.eventCardHero}>
          <EventCover event={event} />
          <div className={styles.heroBody}>
            {event.category && <p className={styles.heroKicker}>{t(event.category)}</p>}
            <BiTitle id="event-title" as="h1" size="lg" bn={event.title?.bn || ''} en={event.title?.en || ''} className={styles.eventTitle} />
            {event.tagline && <p className={styles.tagline}>{t(event.tagline)}</p>}
            <EventFacts event={event} />
            <StatusBlock event={event} />
            <ActionBar event={event} couponEvents={couponEvents} />
          </div>
        </article>
        <div className={styles.desktopArt}>
          <EventCover event={event} desktop />
        </div>
      </div>
    </section>
  );
}

export default function EventHub({ slug: fixedSlug, event: providedEvent, afterHighlights = null, beforeHero = null, afterHub = null, showUpdates = false }) {
  const params = useParams();
  const slug = fixedSlug || params.slug;
  const { t } = useLocale();
  const eventReq = useApi(providedEvent ? null : `event:${slug}`, () => contentApi.event(slug));
  const event = providedEvent || eventReq.data;
  const site = useApi('site', contentApi.site);
  const events = useApi('events', () => contentApi.events());
  const couponReq = useApi(event?.slug ? `coupon-events:${event.slug}` : null, () => couponsApi.openEvents(event.slug));
  const updates = useApi(showUpdates ? 'announcements:v2-updates' : null, () => announcementsApi.list(8));
  useScrollToHash(Boolean(event));

  const couponEvents = couponReq.data || [];
  const sectionIds = usePresentSections({ event: event || {}, couponEvents, site: site.data, announcements: showUpdates ? updates.data || [] : [] });

  if (eventReq.error?.status === 404) return <NotFound />;
  if (!event && eventReq.loading) return <div className="container section"><LoadingState lines={6} /></div>;
  if (!event && eventReq.error) return <div className="container section"><ErrorState error={eventReq.error} onRetry={eventReq.retry} /></div>;
  if (!event) return <NotFound />;

  return (
    <>
      <Seo title={event.title?.en} description={t(event.summary) || t(event.tagline)} type="article" image={event.image?.src || undefined} />
      <EventJsonLd event={event} />
      {showUpdates && <UpdateBubbles announcements={updates.data || []} />}
      {beforeHero}
      <Hero event={event} couponEvents={couponEvents} />
      <SectionNav sections={sectionIds} />
      <main className={styles.hubMain}>
        <div className={`container ${styles.hubGrid}`}>
          <DayChipsSchedule event={event} />
          <PassCards couponEvents={couponEvents} />
          <SponsorBand event={event} />
          <Highlights event={event} />
          {afterHighlights}
          <VenueSection event={event} />
          <ComingUp events={events.data || []} currentSlug={event.slug} />
          <EventContacts event={event} site={site.data} />
          {event.description?.length > 0 && (
            <section className={`${styles.section} ${styles.aboutEvent}`} aria-labelledby="about-event-title">
              <BiTitle id="about-event-title" as="h2" size="sm" bn="এই অনুষ্ঠান" en="About this event" className={styles.hubHeading} />
              {event.description.map((p, i) => <p key={i} className={styles.prose}>{t(p)}</p>)}
            </section>
          )}
        </div>
      </main>
      {afterHub}
    </>
  );
}
