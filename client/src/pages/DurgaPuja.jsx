import Alpana from '../components/motifs/Alpana.jsx';
import Icon from '../components/motifs/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import CouponsCta from '../components/coupons/CouponsCta.jsx';
import Countdown from '../components/ui/Countdown.jsx';
import { countdownProps } from '../components/ui/countdownEvent.js';
import AlpanaMedallion from '../components/ui/AlpanaMedallion.jsx';
import VenueCard from '../components/ui/VenueCard.jsx';
import FeatureCard, { FeatureGrid } from '../components/ui/FeatureCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import Schedule from '../components/ui/Schedule.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { durgaPuja, home } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { useScrollToHash } from '../hooks/useScrollToHash.js';
import { formatDateRange } from '../i18n/format.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import styles from './DurgaPuja.module.css';

const SLUG = 'durga-puja-2026';

/** schema.org Event markup so search engines can show dates and location. */
function EventJsonLd({ event }) {
  const v = event.venue;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${event.title.en} — Parbon Sanskritik Samity`,
    alternateName: event.title.bn,
    description: event.summary?.en,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'Organization', name: 'Parbon Sanskritik Samity' },
    ...(v?.name && {
      location: {
        '@type': 'Place',
        name: v.name.en,
        address: v.address?.en,
        ...(v.geo && { geo: { '@type': 'GeoCoordinates', latitude: v.geo.lat, longitude: v.geo.lng } }),
        ...(v.mapUrl && { hasMap: v.mapUrl }),
      },
    }),
  };
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}

/** The official schedule poster, shown first so the whole Puja can be taken in at a glance. */
function SchedulePoster({ event }) {
  const { t } = useLocale();
  const { image, venue } = event;
  const copy = durgaPuja.days.poster;
  return (
    <figure className={`${styles.poster} reveal`} style={{ '--poster': `url("${image.src}")` }}>
      <a href={image.src} target="_blank" rel="noopener" className={styles.posterFrame}>
        <img src={image.src} alt={image.alt || t(copy.title)} width={image.width || undefined} height={image.height || undefined} decoding="async" />
        <span className="visually-hidden">(opens the full-size poster)</span>
      </a>
      <figcaption className={styles.posterText}>
        <span className={styles.posterEyebrow}>{t(copy.eyebrow)}</span>
        <span lang="bn" className={styles.posterBn}>
          {copy.title.bn}
        </span>
        <span className={styles.posterEn}>{copy.title.en}</span>
        <span className={styles.posterMeta}>
          {formatDateRange(event.startDate, event.endDate, 'en')}
          {venue?.name && (
            <>
              <br />
              {t(venue.name)}
              {venue.area && <>, {t(venue.area)}</>}
            </>
          )}
        </span>
        <span className={styles.posterActions}>
          <a href={image.src} target="_blank" rel="noopener" className={styles.posterBtn}>
            {t(copy.open)}
          </a>
          <a href={image.src} download className={`${styles.posterBtn} ${styles.posterBtnGhost}`}>
            {t(copy.download)}
          </a>
        </span>
      </figcaption>
    </figure>
  );
}

export default function DurgaPuja() {
  const { t } = useLocale();
  const { data: event, loading, error, retry } = useApi(`event:${SLUG}`, () => contentApi.event(SLUG));
  useScrollToHash(Boolean(event));

  return (
    <>
      <Seo
        title="Durga Puja 2026"
        description="Join Parbon Sanskritik Samity for our first Sharadiya Durgotsav, 15–21 October 2026, at Nirusa Banquet, Lingampally (beside Sancta Maria School), Hyderabad — from Panchami Puja and Bodhon to Sandhi Puja, Anjali, Sindoor Khela and Bishorjon."
      />
      {event && <EventJsonLd event={event} />}
      <PageHero {...durgaPuja.hero} art={<AlpanaMedallion />}>
        <div className={styles.heroMeta}>
          {event && (
            <p className={styles.dates}>
              <span>{formatDateRange(event.startDate, event.endDate, 'en')}</span>
              <span lang="bn">{formatDateRange(event.startDate, event.endDate, 'bn')}</span>
            </p>
          )}
          {event?.venue?.name && (
            <p className={styles.venueLine}>
              <Icon name="pin" size={18} />
              <a href="#venue">
                {t(event.venue.name)}
                {event.venue.spot && <> · {t(event.venue.spot)}</>}
              </a>
              {event.venue.area && <span className={styles.venueArea}>{t(event.venue.area)}</span>}
            </p>
          )}
          {event?.countdownTo && event.status !== 'past' && (
            <div className={styles.countdown}>
              <Countdown {...countdownProps(event, { onEventPage: true })} />
            </div>
          )}
          <CouponsCta siteEventSlug={SLUG} className={styles.couponsCta} />
        </div>
      </PageHero>

      <section className="section section--paper" aria-labelledby="meaning-title">
        <div className={`container ${styles.meaningGrid}`}>
          <div>
            <SectionHeading id="meaning-title" eyebrow={durgaPuja.meaning.eyebrow} title={durgaPuja.meaning.title} align="start" />
            <div className={`${styles.meaningBody} reveal`}>
              {durgaPuja.meaning.body.map((p, i) => (
                <div key={i} className={styles.para}>
                  <p>{t(p)}</p>
                  <p lang="bn" className={styles.bn}>
                    {p.bn}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <figure className={`${styles.mantra} reveal`}>
            <Alpana className={styles.mantraAlpana} strokeWidth={1} />
            <blockquote>
              <p lang="bn" className={styles.mantraBn}>
                {home.quote.text.bn}
              </p>
              <p className={styles.mantraEn}>{home.quote.text.en}</p>
            </blockquote>
            <figcaption>
              — <span lang="bn">{home.quote.source.bn}</span> · {home.quote.source.en}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section" aria-labelledby="days-title" id="schedule">
        <div className="container-narrow">
          <SectionHeading id="days-title" eyebrow={durgaPuja.days.eyebrow} title={durgaPuja.days.title} />
          {loading && <LoadingState lines={5} />}
          {error && <ErrorState error={error} onRetry={retry} />}
        </div>
        {event?.image?.src && (
          <div className="container">
            <SchedulePoster event={event} />
          </div>
        )}
        {event?.schedule?.length > 0 && (
          <div className="container-narrow">
            {event.image?.src && (
              <p className={styles.dayByDay}>
                <span lang="bn">{durgaPuja.days.list.bn}</span> · {durgaPuja.days.list.en}
              </p>
            )}
            <Schedule days={event.schedule} note={event.scheduleNote} />
          </div>
        )}
      </section>

      {event?.highlights?.length > 0 && (
        <section className={styles.highlights} aria-labelledby="highlights-title">
          <div className="container">
            <SectionHeading id="highlights-title" eyebrow={durgaPuja.highlights.eyebrow} title={durgaPuja.highlights.title} tone="dark" divider />
            <FeatureGrid min="280px">
              {event.highlights.map((h) => (
                <FeatureCard key={h.icon + h.title.en} icon={h.icon} title={h.title} text={h.text} tone="dark" />
              ))}
            </FeatureGrid>
          </div>
        </section>
      )}

      <section className="section section--paper" aria-labelledby="visit-title" id="venue">
        <div className="container">
          <SectionHeading id="visit-title" eyebrow={durgaPuja.visit.eyebrow} title={durgaPuja.visit.title} intro={durgaPuja.visit.intro} />
          {event?.venue && (
            <div className={`${styles.venue} reveal`}>
              <VenueCard venue={event.venue} />
            </div>
          )}
          <dl className={styles.visit}>
            {durgaPuja.visit.items.map((item) => (
              <div key={item.title.en} className={`${styles.visitItem} reveal`}>
                <dt>
                  {t(item.title)} <span lang="bn">{item.title.bn}</span>
                </dt>
                <dd>{t(item.text)}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.actions}>
            <Button to="/get-involved#volunteer" arrow>
              Volunteer for the Puja
            </Button>
            <Button to="/get-involved#sponsorship" variant="secondary">
              Support the Puja
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.farewell} aria-label="Farewell">
        <p lang="bn" className={`${styles.farewellBn} reveal`}>
          {durgaPuja.farewell.bn}
        </p>
        <p className={styles.farewellEn}>{durgaPuja.farewell.en}</p>
      </section>
    </>
  );
}
