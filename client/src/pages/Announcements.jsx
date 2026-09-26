import AnnouncementCard from '../components/announcements/AnnouncementCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import Seo from '../components/ui/Seo.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { announcements as copy } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { announcementsApi } from '../services/api.js';
import styles from './Announcements.module.css';

export default function Announcements() {
  const { data, loading, error, retry } = useApi('announcements', () => announcementsApi.list());

  return (
    <>
      <Seo title="Announcements" description="The latest news and announcements from Parbon Sanskritik Samity — Durga Puja 2026 and more." />
      <PageHero {...copy.hero} />
      <section className="section" aria-label="Announcements">
        <div className={styles.feed}>
          {loading && <LoadingState lines={4} />}
          {error && <ErrorState error={error} onRetry={retry} />}
          {data?.length === 0 && <EmptyState title={copy.empty.title} text={copy.empty.text} />}
          {data?.map((a) => (
            <div key={a.id} className="reveal">
              <AnnouncementCard announcement={a} compact headingLevel="h2" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
