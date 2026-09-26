import EventCard from '../components/ui/EventCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { events as copy } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { contentApi } from '../services/api.js';
import styles from './Events.module.css';

export default function Events() {
  const { data, loading, error, retry } = useApi('events', () => contentApi.events());
  const upcoming = (data || []).filter((e) => e.status === 'upcoming');
  const planned = (data || []).filter((e) => e.status === 'planned');
  const past = (data || []).filter((e) => e.status === 'past');

  return (
    <>
      <Seo
        title="Events"
        description="Upcoming celebrations from Parbon Sanskritik Samity — Durga Puja 2026 and Bijoya Sammilani."
      />
      <PageHero {...copy.hero} />

      <section className="section" aria-labelledby="upcoming-title">
        <div className="container">
          <SectionHeading id="upcoming-title" title={copy.upcoming.title} align="start" />
          {loading && <LoadingState lines={4} />}
          {error && <ErrorState error={error} onRetry={retry} />}
          <div className={styles.list}>
            {upcoming.map((e) => (
              <EventCard key={e.slug} event={e} featured={e.featured} />
            ))}
          </div>
        </div>
      </section>

      {planned.length > 0 && (
        <section className="section section--tint" aria-labelledby="planned-title">
          <div className="container">
            <SectionHeading id="planned-title" title={copy.planned.title} intro={copy.planned.text} align="start" />
            <div className={styles.grid}>
              {planned.map((e) => (
                <EventCard key={e.slug} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section" aria-labelledby="past-title">
          <div className="container">
            <SectionHeading id="past-title" title={{ bn: 'ফেলে আসা দিন', en: 'Past celebrations' }} align="start" />
            <div className={styles.grid}>
              {past.map((e) => (
                <EventCard key={e.slug} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
