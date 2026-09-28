import { useEffect, useState } from 'react';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { ApiError, adminApi } from '../../services/api.js';
import { AdminBar } from './AdminAnnouncements.jsx';
import { useAdminSession } from './adminSession.js';
import styles from './Admin.module.css';

const LABELS = { announcements: 'Announcements', inquiries: 'Form responses', media: 'Uploaded images' };
const KINDS = { announcements: 'Announcements file', inquiries: 'Form responses file' };

const when = (iso) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

/** Where the site keeps its data, and what was imported from old files (to check the MySQL migration). */
export default function AdminStorage() {
  const session = useAdminSession({ require: true });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminApi.storage().then(setData, (err) => {
      // 503 still carries a useful body ("unavailable" + reason).
      if (err instanceof ApiError && err.status === 503) setData({ storage: 'mysql', status: 'unavailable' });
      else setError(err);
    });
  }, [session.status]);

  if (session.status !== 'authed') {
    return (
      <div className="container section">
        <LoadingState />
      </div>
    );
  }

  return (
    <>
      <Seo title="Storage" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <h1 id="page-title" className={styles.h1}>
            <span lang="bn">ভাণ্ডার</span> Storage
          </h1>
          {error && <ErrorState error={error} />}
          {!data && !error && <LoadingState lines={4} />}

          {data?.storage === 'file' && (
            <p className={styles.notice}>
              Using <strong>files</strong> in <code>{data.path}</code>. On Hostinger these are lost on every deploy. Set DB_NAME, DB_USER and
              DB_PASSWORD to use MySQL.
            </p>
          )}

          {data?.storage === 'mysql' && data.status === 'unavailable' && (
            <p className={styles.formError} role="alert">
              MySQL is configured but can’t be reached right now. Check DB_HOST, DB_NAME, DB_USER and DB_PASSWORD in hPanel, then look at the
              runtime logs. Public pages keep working meanwhile.
            </p>
          )}

          {data?.status === 'connected' && (
            <>
              <p className={styles.listSummary}>
                ✅ Connected to MySQL database <strong>{data.database.name}</strong> on {data.database.host}:{data.database.port}. Data here
                survives redeploys.
              </p>
              <div className={styles.statGrid}>
                {Object.entries(data.counts).map(([key, n]) => (
                  <div key={key} className={styles.stat}>
                    <span className={styles.statValue}>{n}</span>
                    <span className={styles.statLabel}>{LABELS[key] || key}</span>
                  </div>
                ))}
              </div>

              <h2 className={styles.h2}>Imported from old files</h2>
              {data.imports.length === 0 ? (
                <p className="muted">Nothing imported yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">What</th>
                        <th scope="col">New rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.imports.map((r, i) => (
                        <tr key={i}>
                          <td className={styles.nowrap}>{when(r.importedAt)}</td>
                          <td>{KINDS[r.kind] || r.kind}</td>
                          <td>{r.rows}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h2 className={styles.h2}>Earlier deployment folders checked</h2>
              {data.previousDeployments.length === 0 ? (
                <p className="muted">None found (normal outside Hostinger, or once old folders are removed).</p>
              ) : (
                <ul className={styles.pathList}>
                  {data.previousDeployments.map((dir) => (
                    <li key={dir}>
                      <code>{dir}</code>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
