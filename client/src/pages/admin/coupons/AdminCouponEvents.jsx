import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { REGISTRATION_LABELS, formatWhen } from '../../../components/coupons/couponUtils.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminCouponsApi } from '../../../services/api.js';
import { AdminBar } from '../AdminAnnouncements.jsx';
import { useAdminSession } from '../adminSession.js';
import styles from '../Admin.module.css';
import c from './Coupons.module.css';

export function CouponsDisabled() {
  return (
    <div className={c.disabled}>
      <Icon name="alpana" size={40} />
      <p>
        <strong>Coupons need the database.</strong> Set the <code>DB_*</code> variables (Hostinger → Databases) and restart the app to switch
        coupons on.
      </p>
    </div>
  );
}

export default function AdminCouponEvents() {
  const session = useAdminSession({ require: true });
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminCouponsApi.status().then((s) => {
      setStatus(s);
      if (s.enabled) adminCouponsApi.events().then(setEvents, setError);
    }, setError);
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
      <Seo title="Coupons" noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <div className={styles.head}>
            <h1 id="page-title" className={styles.h1}>
              <span lang="bn">কুপন</span> Coupons
            </h1>
            {status?.enabled && (
              <div className={c.headActions}>
                <Button to="/admin/coupons/gate-team" variant="secondary">
                  Gate team
                </Button>
                <Button to="/scan" variant="secondary">
                  Open scanner
                </Button>
                <Button to="/admin/coupons/new" arrow>
                  New event
                </Button>
              </div>
            )}
          </div>
          {error && <ErrorState error={error} />}
          {status && !status.enabled && <CouponsDisabled />}
          {status?.enabled && !status.mailEnabled && (
            <p className={styles.notice}>Email isn’t set up, so people get their coupons as links to share on WhatsApp or copy (no emails).</p>
          )}
          {status?.enabled && !events && !error && <LoadingState lines={3} />}
          {events?.length === 0 && (
            <div className={c.empty}>
              <p>No coupon events yet.</p>
              <p className="muted">Create an event, add coupon types (entry pass, food coupon…), design them, then open registrations.</p>
              <Button to="/admin/coupons/new" arrow>
                Create the first event
              </Button>
            </div>
          )}
          {events?.length > 0 && (
            <ul className={styles.list} role="list">
              {events.map((e) => (
                <li key={e.id} className={styles.row}>
                  <span className={styles.thumb} aria-hidden="true">
                    <Icon name="dhak" size={28} />
                  </span>
                  <div className={`${styles.rowMain} ${c.eventMain}`}>
                    <p className={styles.rowTitle}>
                      <Link to={`/admin/coupons/${e.id}`}>{e.title.en}</Link>
                    </p>
                    <p className={styles.rowMeta}>
                      <span className={`${c.state} ${c[`state_${e.registration}`]}`}>{REGISTRATION_LABELS[e.registration]}</span>
                      <span>{formatWhen(e.startsAt)}</span>
                      <span>
                        {e.stats.issued}/{e.totalQuota} issued · {e.stats.checkedIn} checked in · {e.stats.registrations} registrations
                      </span>
                    </p>
                    <div className={c.meter} aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (e.stats.issued / e.totalQuota) * 100)}%` }} />
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    {e.registration === 'open' && (
                      <Link to={`/register/${e.slug}`} target="_blank">
                        Public page ↗
                      </Link>
                    )}
                    <Link to={`/admin/coupons/${e.id}`}>Manage</Link>
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
