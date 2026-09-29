import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PAYMENT_LABELS, REGISTRATION_LABELS, copyText, formatWhen, rupees, whatsappUrl } from '../../../components/coupons/couponUtils.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminApi, adminCouponsApi } from '../../../services/api.js';
import { AdminBar } from '../AdminAnnouncements.jsx';
import { useAdminSession } from '../adminSession.js';
import styles from '../Admin.module.css';
import { CouponsDisabled } from './AdminCouponEvents.jsx';
import CouponEventForm from './CouponEventForm.jsx';
import CouponPeoplePanel from './CouponPeoplePanel.jsx';
import CouponTypesPanel from './CouponTypesPanel.jsx';
import { PresetPicker, PresetTypes } from './QuickStart.jsx';
import { templateById } from '../../../components/coupons/templates.js';
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
        <Button to="/admin/coupons/gate-team" variant="secondary">
          Gate team
        </Button>
        <Button variant="secondary" onClick={() => onTab('people')}>
          See attendees
        </Button>
      </div>
    </div>
  );
}

/** A website event (Admin → Events) → the starting fields of its coupon event. */
function fromSiteEvent(ev) {
  const ist = (date, time, fallback) => (date ? new Date(`${date}T${time || fallback}:00+05:30`).toISOString() : undefined);
  const out = {
    title: ev.title,
    tagline: ev.tagline || { en: '', bn: '' },
    description: { en: ev.summary?.en || '', bn: '' },
    slug: ev.slug,
    linkedEventSlug: ev.slug,
    startsAt: ist(ev.startDate, ev.startTime, '09:00'),
    endsAt: ist(ev.endDate || ev.startDate, ev.endTime, '22:00'),
    venue: ev.venue
      ? { name: [ev.venue.name?.en, ev.venue.spot?.en].filter(Boolean).join(' — '), address: ev.venue.address?.en || '', mapUrl: ev.venue.mapUrl || '' }
      : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

/** `base` if no coupon event uses it yet, otherwise base-2, base-3, … */
function freeSlug(base, couponEvents) {
  const taken = new Set(couponEvents.map((e) => e.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** A new event: choose the website event (optional) and a ready-made event (or blank), then check the details and create everything. */
function NewEvent({ onCreated }) {
  const [step, setStep] = useState('pick');
  const [preset, setPreset] = useState(null);
  const [types, setTypes] = useState([]);
  const [typeErrors, setTypeErrors] = useState({});
  const [couponEvents, setCouponEvents] = useState(null);
  const [siteEvents, setSiteEvents] = useState(null);
  const [params, setParams] = useSearchParams();
  const from = params.get('from') || '';

  // Existing coupon events (to reuse the latest venue/contact/payment details and to spot one already
  // made for the chosen website event) and every website event, drafts included, for the picker.
  useEffect(() => {
    adminCouponsApi.events().then((list) => setCouponEvents(list || []), () => setCouponEvents([]));
    adminApi.events().then((list) => setSiteEvents(list || []), () => setSiteEvents([]));
  }, []);

  const previous = couponEvents?.[0] || null;
  const siteEvent = from ? siteEvents?.find((x) => x.slug === from) : null;
  const existing = from && couponEvents ? couponEvents.filter((e) => e.linkedEventSlug === from || e.slug === from) : [];
  // The website event's name, dates and venue — with a link name no other coupon event uses.
  const linked = siteEvent ? { ...fromSiteEvent(siteEvent), slug: freeSlug(siteEvent.slug, couponEvents || []) } : null;

  const chooseSiteEvent = (slug) => setParams(slug ? { from: slug } : {}, { replace: true });

  const pick = (p) => {
    const base = { ...(previous ? { venue: previous.venue, contact: previous.contact, payment: previous.payment } : {}), ...(p?.event || {}), ...(linked || {}) };
    setPreset(p ? { ...p, event: base } : linked ? { id: 'linked', label: linked.title.en, types: [], event: base } : null);
    setTypes(p ? p.types.map((t) => ({ ...t, enabled: true })) : []);
    setTypeErrors({});
    setStep('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // One request: the event and its ticked coupon types are saved together, or not at all.
  const enabledRows = types.map((t, i) => (t.enabled ? i : -1)).filter((i) => i >= 0);
  const save = (data) =>
    adminCouponsApi.createEvent({
      ...data,
      types: enabledRows.map((row, order) => {
        const { template, enabled: _enabled, ...type } = types[row];
        return { ...type, price: Math.round(Number(type.price) || 0), sortOrder: order, design: structuredClone(templateById(template).design) };
      }),
    });

  // "types.<n>.<field>" errors → the preset row they belong to, and a readable name for the summary.
  const onErrors = (fields) => {
    const byRow = {};
    for (const [key, message] of Object.entries(fields || {})) {
      const m = key.match(/^types\.(\d+)\./);
      if (m && enabledRows[Number(m[1])] !== undefined) (byRow[enabledRows[Number(m[1])]] ||= []).push(message);
    }
    setTypeErrors(byRow);
  };
  const typeLabel = (n) => (types[enabledRows[n]] ? `Coupon “${types[enabledRows[n]].name.en}”` : `Coupon type ${n + 1}`);

  const linkNotice = existing.length > 0 && (
    <p className={styles.notice}>
      <strong>{siteEvent?.title.en || from}</strong> already has a coupon event:{' '}
      {existing.map((e, i) => (
        <span key={e.id}>
          {i > 0 && ', '}
          <Link to={`/admin/coupons/${e.id}`}>open “{e.title.en}”</Link>
        </span>
      ))}
      . To add coupon types to it, open it instead. Creating another one gives it its own link name ({linked?.slug}).
    </p>
  );

  if (step === 'pick') {
    return (
      <>
        <div className={`${styles.field} ${c.linkPick}`}>
          <label htmlFor="coupon-site-event">Which website event are these coupons for?</label>
          <select id="coupon-site-event" value={siteEvents ? from : ''} onChange={(e) => chooseSiteEvent(e.target.value)} disabled={!siteEvents}>
            <option value="">{siteEvents ? '— Not linked to a website event —' : 'Loading events…'}</option>
            {(siteEvents || []).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title.en}
                {s.startDate ? ` · ${s.startDate}` : ''}
                {s.state === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
          <p className={styles.hint}>Its name, dates and venue are filled in, and its page on the website gets a “Get your coupons” button. Optional.</p>
        </div>
        {from && siteEvents && !siteEvent && <p className={styles.formError}>That website event wasn’t found. Choose one from the list, or leave it unlinked.</p>}
        {linkNotice}
        {linked && !existing.length && (
          <p className={styles.notice}>
            Setting up registration &amp; coupons for <strong>{linked.title.en}</strong> — its name, dates and venue are filled in and it will be linked
            to the event page. Pick the kind of coupons to start with.
          </p>
        )}
        {from && (!siteEvents || !couponEvents) ? <LoadingState lines={3} /> : <PresetPicker onPick={pick} />}
      </>
    );
  }
  const count = enabledRows.length;
  return (
    <div className={c.narrow}>
      <p className={c.crumb}>
        <button type="button" className={styles.linkBtn} onClick={() => setStep('pick')}>
          ← Choose a different starting point
        </button>
      </p>
      {linkNotice}
      {preset && (
        <p className={styles.notice}>
          Starting from <strong>{preset.label}</strong>. Check the dates, venue and payment details below, then create — the coupons are ready to use
          straight away.
        </p>
      )}
      <div className={c.panel}>
        {preset?.types.length > 0 && <PresetTypes preset={preset} event={preset.event} value={types} onChange={setTypes} errors={typeErrors} />}
        <CouponEventForm
          key={preset?.id || 'blank'}
          preset={preset?.event}
          siteEvents={siteEvents}
          save={save}
          onSaved={onCreated}
          onErrors={onErrors}
          describeKey={(key) => {
            const m = key.match(/^types\.(\d+)\./);
            return m ? typeLabel(Number(m[1])) : null;
          }}
          submitLabel={preset && count ? `Create event & ${count} coupon type${count === 1 ? '' : 's'}` : 'Create event'}
        />
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
              <NewEvent onCreated={(saved) => navigate(`/admin/coupons/${saved.id}?tab=types`, { replace: true })} />
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
