import { useParams } from 'react-router';
import CouponsCta from '../components/coupons/CouponsCta.jsx';
import Button from '../components/ui/Button.jsx';
import FeatureCard, { FeatureGrid } from '../components/ui/FeatureCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import Schedule from '../components/ui/Schedule.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import VenueCard from '../components/ui/VenueCard.jsx';
import { useApi } from '../hooks/useApi.js';
import { useScrollToHash } from '../hooks/useScrollToHash.js';
import { formatDateRange } from '../i18n/format.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import NotFound from './NotFound.jsx';
import styles from './EventDetail.module.css';

export default function EventDetail() {
  const { slug } = useParams();
  const { t } = useLocale();
  const { data: event, loading, error, retry } = useApi(`event:${slug}`, () => contentApi.event(slug));
  useScrollToHash(Boolean(event));

  if (error?.status === 404) return <NotFound />;
  if (loading) {
    return (
      <div className="container section">
        <LoadingState lines={5} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const when = event.startDate ? formatDateRange(event.startDate, event.endDate, 'en') : t(event.dateLabel);
  const whenBn = event.startDate ? formatDateRange(event.startDate, event.endDate, 'bn') : event.dateLabel?.bn;

  return (
    <>
      <Seo title={event.title.en} description={t(event.summary)} type="article" />
      <PageHero eyebrow={event.category} title={event.title} intro={event.summary}>
        <dl className={styles.facts}>
          <div>
            <dt>When</dt>
            <dd>
              {when}
              {whenBn && (
                <span lang="bn" className={styles.bn}>
                  {whenBn}
                </span>
              )}
            </dd>
          </div>
          {event.venue?.name && (
            <div>
              <dt>Where</dt>
              <dd>
                <a href="#venue" className={styles.whereLink}>
                  {t(event.venue.name)}
                </a>
                <span className={styles.whereMeta}>
                  {[t(event.venue.spot), t(event.venue.area)].filter(Boolean).join(' · ')}
                </span>
              </dd>
            </div>
          )}
        </dl>
        <CouponsCta siteEventSlug={event.slug} className={styles.couponsCta} />
      </PageHero>

      {event.description?.length > 0 && (
        <section className="section section--paper" aria-label="About this event">
          <div className={`container-narrow ${styles.prose}`}>
            {event.description.map((p, i) => (
              <div key={i} className={`${styles.para} reveal`}>
                <p>{t(p)}</p>
                <p lang="bn" className={styles.paraBn}>
                  {p.bn}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {event.schedule?.length > 0 && (
        <section className="section" aria-labelledby="schedule-title">
          <div className="container-narrow">
            <SectionHeading id="schedule-title" eyebrow={{ en: 'Schedule' }} title={{ bn: 'নির্ঘণ্ট', en: 'Day by day' }} />
            <Schedule days={event.schedule} note={event.scheduleNote} />
          </div>
        </section>
      )}

      {event.highlights?.length > 0 && (
        <section className="section section--tint" aria-labelledby="highlights-title">
          <div className="container">
            <SectionHeading id="highlights-title" title={{ bn: 'যা থাকছে', en: 'Highlights' }} />
            <FeatureGrid min="280px">
              {event.highlights.map((h) => (
                <FeatureCard key={h.title.en} {...h} />
              ))}
            </FeatureGrid>
          </div>
        </section>
      )}

      {event.venue?.name && (
        <section id="venue" className="section section--paper" aria-labelledby="venue-title">
          <div className="container">
            <SectionHeading id="venue-title" eyebrow={{ en: 'Venue' }} title={{ bn: 'মায়ের মণ্ডপ', en: 'Where to find us' }} />
            <VenueCard venue={event.venue} />
          </div>
        </section>
      )}

      <section className="section section--paper">
        <div className={`container-narrow ${styles.cta}`}>
          <p lang="bn" className={styles.ctaBn}>
            আপনিও সামিল হোন
          </p>
          <p className={styles.ctaEn}>Want to help make it happen?</p>
          <div className={styles.actions}>
            <Button to="/get-involved#volunteer" arrow>
              Volunteer
            </Button>
            <Button to="/contact" variant="secondary">
              Ask a question
            </Button>
            <Button to="/events" variant="link">
              ← All events
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
