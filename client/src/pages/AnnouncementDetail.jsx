import { useParams } from 'react-router';
import AnnouncementCard from '../components/announcements/AnnouncementCard.jsx';
import Button from '../components/ui/Button.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { announcementsApi } from '../services/api.js';
import NotFound from './NotFound.jsx';
import styles from './Announcements.module.css';

const summary = (text = '') => text.replace(/\s+/g, ' ').trim().slice(0, 155);

export default function AnnouncementDetail() {
  const { slug } = useParams();
  const { data, loading, error, retry } = useApi(`announcements:${slug}`, () => announcementsApi.get(slug));

  if (error?.status === 404) return <NotFound />;

  return (
    <section className="section" aria-labelledby="page-title">
      {data && (
        <Seo title={data.title.en} description={summary(data.body?.en || data.body?.bn)} image={data.image?.src} type="article" />
      )}
      <div className={styles.feed}>
        <div className={styles.back}>
          <Button to="/announcements" variant="link">
            ← All announcements
          </Button>
        </div>
        {loading && <LoadingState lines={5} />}
        {error && <ErrorState error={error} onRetry={retry} />}
        {data && (
          <>
            <h1 id="page-title" className="visually-hidden">
              {data.title.en}
            </h1>
            <AnnouncementCard announcement={data} headingLevel="h2" />
          </>
        )}
      </div>
    </section>
  );
}
