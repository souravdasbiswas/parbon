import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PAYMENT_LABELS, REGISTRATION_LABELS, copyText, formatWhen, rupees, whatsappUrl } from '../../../components/coupons/couponUtils.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminCouponsApi } from '../../../services/api.js';
import { AdminBar } from '../AdminAnnouncements.jsx';
import { useAdminSession } from '../adminSession.js';
import styles from '../Admin.module.css';
import { CouponsDisabled } from './AdminCouponEvents.jsx';
import CouponEventForm from './CouponEventForm.jsx';
import CouponPeoplePanel from './CouponPeoplePanel.jsx';
import CouponTypesPanel from './CouponTypesPanel.jsx';
import c from './Coupons.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'Attendees & coupons' },
  { id: 'types', label: 'Coupon types & designs' },
  { id: 'details', label: 'Event details' },
];

function Stat({ label, value, sub }) {
  return (
    <div className={c.stat}>
      <p className={c.statValue}>{value}</p>
      <p className={c.statLabel}>{label}</p>
      {sub && <p className={c.statSub}>{sub}</p>}
    </div>
  );
}

function Overview({ event, onTab }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/register/${event.slug}`;
  const share = `🪔 ${event.title.en}\nRegister and get your coupons here:\n${link}`;
  const pay = event.stats.payments || {};
  const pending = (pay.to_verify?.count || 0) + (pay.pledged?.count || 0);

  return (
    <div className={c.panel}>
      <div className={c.stats}>
        <Stat label="Coupons issued" value={`${event.stats.issued} / ${event.totalQuota}`} sub={`${event.stats.remaining} left`} />
        <Stat label="Checked in / used" value={event.stats.checkedIn} sub={event.stats.issued ? `${Math.round((event.stats.checkedIn / event.stats.issued) * 100)}% of issued` : ''} />
        <Stat label="Payments to follow up" value={pending} sub={`${pay.to_verify?.count || 0} to verify · ${pay.pledged?.count || 0} at counter`} />
        <Stat label="Collected (marked paid)" value={rupees(pay.paid?.amount || 0)} sub={`${pay.paid?.count || 0} registrations`} />
      </div>

      {event.registration === 'open' ? (
        <div className={c.share}>
          <p>
            <strong>Registrations are open.</strong> Share this link:
          </p>
          <div className={c.couponActions}>
            <code className={c.code}>{link}</code>
            <button
              type="button"
              className={c.iconAction}
              onClick={async () => {
                setCopied(await copyText(link));
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy'}
            </button>
            <a className={c.iconAction} href={whatsappUrl(share)} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" size={16} /> WhatsApp
            </a>
            <a className={c.iconAction} href={link} target="_blank" rel="noopener noreferrer">
              <Icon name="link" size={16} /> Open
            </a>
          </div>
        </div>
      ) : (
        <p className={styles.notice}>
          Registrations are <strong>{REGISTRATION_LABELS[event.registration].toLowerCase()}</strong>.{' '}
          {event.registration === 'draft' && (
            <>
              Add coupon types, then set the event to “Open” in{' '}
              <button type="button" className={styles.linkBtn} onClick={() => onTab('details')}>
                Event details
              </button>
              .
            </>
          )}
        </p>
      )}

      <h2 className={c.h3}>By coupon type</h2>
      {event.types.length === 0 ? (
        <p className="muted">
          No coupon types yet.{' '}
          <button type="button" className={styles.linkBtn} onClick={() => onTab('types')}>
            Add one
          </button>
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Price</th>
                <th>Issued</th>
                <th>Checked in / used</th>
                <th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {event.types.map((t) => (
                <tr key={t.id}>
                  <td className={styles.strong}>{t.name.en}</td>
                  <td>{t.price ? rupees(t.price) : 'Free'}</td>
                  <td>
                    {t.stats.issued}
                    {t.quota ? ` / ${t.quota}` : ''}
                  </td>
                  <td>{t.stats.checkedIn}</td>
                  <td>{t.stats.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={c.h3}>Payments</h2>
      <div className={c.chipsStatic}>
        {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
          <span key={k} className={`${c.att} ${c[`pay_${k}`]}`}>
            {v}: {pay[k]?.count || 0} · {rupees(pay[k]?.amount || 0)}
          </span>
        ))}
      </div>

      <div className={styles.formActions}>
        <Button to="/scan" arrow>
          Open the gate scanner
        </Button>
        <Button variant="secondary" onClick={() => onTab('people')}>
          See attendees
        </Button>
      </div>
    </div>
  );
}

export default function AdminCouponEvent() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const session = useAdminSession({ require: true });
  const [status, setStatus] = useState(null);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!isNew) adminCouponsApi.event(id).then(setEvent, setError);
  }, [id, isNew]);

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminCouponsApi.status().then(setStatus, setError);
    reload();
  }, [session.status, reload]);

  const onTab = (next) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true });

  if (session.status !== 'authed' || (!isNew && !event && !error)) {
    return (
      <div className="container section">
        <LoadingState lines={5} />
      </div>
    );
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${event.title.en}”? This cannot be undone.`)) return;
    try {
      await adminCouponsApi.deleteEvent(event.id);
      navigate('/admin/coupons');
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <>
      <Seo title={isNew ? 'New coupon event' : `Coupons — ${event?.title.en || ''}`} noindex />
      <AdminBar session={session} />
      <section className="section" aria-labelledby="page-title">
        <div className="container">
          <p className={c.crumb}>
            <Link to="/admin/coupons">← All coupon events</Link>
          </p>
          {error && <ErrorState error={error} />}
          {status && !status.enabled && <CouponsDisabled />}
          {isNew && status?.enabled && (
            <>
              <h1 id="page-title" className={styles.h1}>
                New coupon event
              </h1>
              <div className={c.narrow}>
                <CouponEventForm save={(data) => adminCouponsApi.createEvent(data)} onSaved={(saved) => navigate(`/admin/coupons/${saved.id}?tab=types`, { replace: true })} />
              </div>
            </>
          )}
          {event && (
            <>
              <div className={styles.head}>
                <div>
                  <h1 id="page-title" className={styles.h1}>
                    {event.title.en}
                  </h1>
                  <p className={styles.rowMeta}>
                    <span className={`${c.state} ${c[`state_${event.registration}`]}`}>{REGISTRATION_LABELS[event.registration]}</span>
                    <span>
                      {formatWhen(event.startsAt)} – {formatWhen(event.endsAt)}
                    </span>
                    {event.venue?.name && <span>{event.venue.name}</span>}
                  </p>
                </div>
              </div>
              <div className={c.tabs} role="tablist" aria-label="Event sections">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`${c.tab} ${tab === t.id ? c.tabActive : ''}`}
                    onClick={() => onTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel">
                {tab === 'overview' && <Overview event={event} onTab={onTab} />}
                {tab === 'people' && <CouponPeoplePanel event={event} mailEnabled={Boolean(status?.mailEnabled)} onChange={reload} />}
                {tab === 'types' && <CouponTypesPanel event={event} onChange={reload} />}
                {tab === 'details' && (
                  <div className={c.narrow}>
                    <CouponEventForm
                      event={event}
                      save={(data) => adminCouponsApi.updateEvent(event.id, data)}
                      onSaved={setEvent}
                      onDelete={remove}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
