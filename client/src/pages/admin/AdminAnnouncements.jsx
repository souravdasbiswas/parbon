import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { invalidateApi } from '../../hooks/useApi.js';
import { announcementIcon } from '../../content/announcementIcons.js';
import { adminApi } from '../../services/api.js';
import { useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

const when = (iso) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

const TICKER_SLOTS = 3;
const isLive = (a) => a.status === 'published' && new Date(a.publishedAt) <= new Date();

export function AdminBar({ session }) {
  return (
    <div className={styles.bar}>
      <div className={`container ${styles.barInner}`}>
        <p>
          <span lang="bn">সমিতির দপ্তর</span> · Admin
          {session.user && <span className={styles.barUser}> — signed in as {session.user.username}</span>}
        </p>
        <nav className={styles.barNav} aria-label="Admin">
          <Link to="/admin/announcements">Announcements</Link>
          <Link to="/admin/coupons">Coupons</Link>
          <Link to="/admin/coupons/gate-team">Gate team</Link>
          <Link to="/admin/responses">Responses</Link>
          <Link to="/admin/storage">Storage</Link>
          <Link to="/scan">Scanner</Link>
          <Link to="/announcements" target="_blank">
            View site ↗
          </Link>
          <button type="button" onClick={session.signOut}>
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}

export default function AdminAnnouncements() {
  const session = useAdminSession({ require: true });
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminApi.announcements().then(setItems, setError);
  }, [session.status]);

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.title.en}”? This cannot be undone.`)) return;
    try {
      await adminApi.deleteAnnouncement(item.id);
      invalidateApi('announcements');
      setItems((list) => list.filter((a) => a.id !== item.id));
    } catch (err) {
      window.alert(err.message);
    }
  };

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  // Same rule as the server: the list is already sorted pinned-first, then newest.
  const tickerIds = new Set(
    (items || [])
      .filter((a) => isLive(a) && a.showInTicker !== false)
      .slice(0, TICKER_SLOTS)
      .map((a) => a.id),
  );

  return (
    <>
      <Seo title="Manage announcements" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <div className={styles.head}>
            <h1 id="page-title" className={styles.h1}>
              <span lang="bn">খবরাখবর</span> Announcements
            </h1>
            <Button to="/admin/announcements/new" arrow>
              New announcement
            </Button>
          </div>
          {error && <ErrorState error={error} />}
          {items?.length > 0 && (
            <p className={styles.listSummary}>
              Home ticker: {tickerIds.size} of {TICKER_SLOTS} slots in use. Tick or untick “Show in the home page ticker” when
              editing an announcement to choose which ones appear.
            </p>
          )}
          {!items && !error && <LoadingState lines={4} />}
          {items?.length === 0 && <p className="muted">No announcements yet — create the first one.</p>}
          {items?.length > 0 && (
            <ul className={styles.list} role="list">
              {items.map((a) => (
                <li key={a.id} className={styles.row}>
                  {a.image?.src ? (
                    <img src={a.image.src} alt="" width="64" height="64" className={styles.thumb} />
                  ) : (
                    <span className={styles.thumb} aria-hidden="true">
                      <Icon name={announcementIcon(a)} size={24} />
                    </span>
                  )}
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>{a.title.en}</p>
                    <p className={styles.rowMeta}>
                      <span className={`${styles.badge} ${a.status === 'draft' ? styles.badgeDraft : ''}`}>
                        {a.status === 'draft' ? 'Draft' : new Date(a.publishedAt) > new Date() ? 'Scheduled' : 'Published'}
                      </span>
                      {a.pinned && <span className={styles.badge}>Pinned</span>}
                      {tickerIds.has(a.id) && <span className={`${styles.badge} ${styles.badgeTicker}`}>In ticker</span>}
                      {a.showInTicker !== false && !tickerIds.has(a.id) && isLive(a) && (
                        <span className={`${styles.badge} ${styles.badgeDraft}`} title="Only 3 ticked announcements fit in the ticker">
                          Ticker full
                        </span>
                      )}
                      <span>{when(a.publishedAt)}</span>
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    {a.status === 'published' && (
                      <Link to={`/announcements/${a.slug}`} target="_blank">
                        View
                      </Link>
                    )}
                    <Link to={`/admin/announcements/${a.id}`}>Edit</Link>
                    <button type="button" className={styles.danger} onClick={() => remove(a)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
