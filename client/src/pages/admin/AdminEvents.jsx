import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { invalidateApi } from '../../hooks/useApi.js';
import { formatDateRange, formatTimeRange } from '../../i18n/format.js';
import { adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

const TIMING = { upcoming: 'Upcoming', planned: 'Date to be announced', past: 'Past' };

/** Draft, Scheduled (published with a future publish time) or Published. */
const visibilityOf = (e) => (e.state !== 'published' ? 'Draft' : new Date(e.publishedAt) > new Date() ? 'Scheduled' : 'Published');

export default function AdminEvents() {
  const session = useAdminSession({ require: true });
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = () => adminApi.events().then(setItems, setError);
  useEffect(() => {
    if (session.status === 'authed') adminApi.events().then(setItems, setError);
  }, [session.status]);

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  const act = async (fn) => {
    try {
      await fn();
      invalidateApi('event');
      await load();
    } catch (err) {
      window.alert(err.message);
    }
  };
  const publishToggle = (e) => act(() => adminApi.updateEvent(e.id, { ...e, state: e.state === 'published' ? 'draft' : 'published', publishedAt: e.state === 'published' ? e.publishedAt : '' }));
  const remove = (e) => window.confirm(`Delete “${e.title.en}”? This cannot be undone.`) && act(() => adminApi.deleteEvent(e.id));

  return (
    <>
      <Seo title="Manage events" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <div className={styles.head}>
            <h1 id="page-title" className={styles.h1}>
              <span lang="bn">অনুষ্ঠান</span> Events
            </h1>
            <Button to="/admin/events/new" arrow>
              New event
            </Button>
          </div>
          <p className={styles.listSummary}>
            In date order: upcoming first (soonest at the top), then “date to be announced”, then past events. Only published events appear on the
            website; Upcoming and Past follow the dates automatically.
          </p>
          {error && <ErrorState error={error} />}
          {!items && !error && <LoadingState lines={4} />}
          {items?.length === 0 && <p className="muted">No events yet — create the first one.</p>}
          {items?.length > 0 && (
            <ul className={styles.list} role="list">
              {items.map((e) => {
                const visibility = visibilityOf(e);
                const when = e.startDate ? `${formatDateRange(e.startDate, e.endDate, 'en')}${e.startTime ? ` · ${formatTimeRange(e.startTime, e.endTime)}` : ''}` : e.dateLabel?.en;
                return (
                  <li key={e.id} className={styles.row}>
                    {e.image?.src ? (
                      <img src={e.image.src} alt="" width="64" height="64" className={styles.thumb} />
                    ) : (
                      <span className={styles.thumb} aria-hidden="true">
                        <Icon name="calendar" size={24} />
                      </span>
                    )}
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>{e.title.en}</p>
                      <p className={styles.rowMeta}>
                        <span className={`${styles.badge} ${visibility === 'Published' ? '' : styles.badgeDraft}`}>{visibility}</span>
                        <span className={`${styles.badge} ${styles.badgeDraft}`}>{TIMING[e.status]}</span>
                        {e.featured && <span className={`${styles.badge} ${styles.badgeTicker}`}>Featured</span>}
                        {e.countdown && <span className={`${styles.badge} ${styles.badgeTicker}`}>Countdown</span>}
                        <span>{when}</span>
                      </p>
                    </div>
                    <div className={styles.rowActions}>
                      {visibility === 'Published' && (
                        <Link to={`/events/${e.slug}`} target="_blank">
                          View
                        </Link>
                      )}
                      <Link to={`/admin/events/${e.id}`}>Edit</Link>
                      <button type="button" className={styles.linkBtn} onClick={() => publishToggle(e)}>
                        {e.state === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className={styles.danger} onClick={() => remove(e)}>
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
