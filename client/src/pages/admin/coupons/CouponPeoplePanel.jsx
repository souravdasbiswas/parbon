import { useEffect, useId, useMemo, useState } from 'react';
import {
  ATTENDANCE_LABELS,
  PAYMENT_LABELS,
  copyText,
  couponShareText,
  formatWhen,
  rupees,
  whatsappUrl,
} from '../../../components/coupons/couponUtils.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminCouponsApi } from '../../../services/api.js';
import styles from '../Admin.module.css';
import { Field } from './formKit.jsx';
import c from './Coupons.module.css';

const PAGE = 60;
const matches = (r, q) =>
  !q ||
  [r.name, r.email, r.phone, r.txnRef, ...r.coupons.map((x) => x.code)]
    .filter(Boolean)
    .some((v) => v.toLowerCase().replace(/-/g, '').includes(q.toLowerCase().replace(/-/g, '')));

function WalkInForm({ event, mailEnabled, onDone, onCancel }) {
  const uid = useId();
  const types = event.types.filter((t) => t.active);
  const [form, setForm] = useState({ name: '', phone: '', email: '', attendees: 1, items: {}, payment: 'paid', txnRef: '', sendEmail: false });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, message: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const total = types.reduce((s, t) => s + (Number(form.items[t.id]) || 0) * t.price, 0);

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, message: '' });
    try {
      const result = await adminCouponsApi.addRegistration(event.id, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        attendees: Number(form.attendees),
        items: types.map((t) => ({ typeId: t.id, quantity: Number(form.items[t.id]) || 0 })),
        paymentMethod: total === 0 ? 'free' : form.payment === 'txn' ? 'txn' : 'pledge',
        txnRef: total > 0 ? form.txnRef : '',
        markPaid: total > 0 && form.payment === 'paid',
        sendEmail: form.sendEmail,
      });
      onDone(result);
    } catch (err) {
      setErrors(err.fields || {});
      setState({ busy: false, message: err.message });
    }
  };

  return (
    <form className={`${styles.group} ${styles.form}`} onSubmit={submit} noValidate>
      <h3 className={c.h3}>Add a registration (walk-in or phone booking)</h3>
      <div className={styles.row2}>
        <Field label="Name" id={`${uid}-name`} error={errors.name} required>
          <input id={`${uid}-name`} value={form.name} onChange={set('name')} maxLength={120} required />
        </Field>
        <Field label="Phone" id={`${uid}-phone`} error={errors.phone}>
          <input id={`${uid}-phone`} type="tel" value={form.phone} onChange={set('phone')} maxLength={20} />
        </Field>
        <Field label="Email" id={`${uid}-email`} error={errors.email}>
          <input id={`${uid}-email`} type="email" value={form.email} onChange={set('email')} maxLength={200} />
        </Field>
        <Field label="People" id={`${uid}-att`} error={errors.attendees}>
          <input id={`${uid}-att`} type="number" min="1" max="100" value={form.attendees} onChange={set('attendees')} />
        </Field>
      </div>
      <div className={c.qtyGrid}>
        {types.map((t) => (
          <Field key={t.id} label={`${t.name.en} (${t.price ? rupees(t.price) : 'free'})`} id={`${uid}-${t.id}`} error={errors[`items.${t.id}`]}>
            <input
              id={`${uid}-${t.id}`}
              type="number"
              min="0"
              max="100"
              value={form.items[t.id] ?? ''}
              placeholder="0"
              onChange={(e) => setForm((f) => ({ ...f, items: { ...f.items, [t.id]: e.target.value } }))}
            />
          </Field>
        ))}
      </div>
      {errors.items && <p className={styles.fieldError}>{errors.items}</p>}
      <div className={c.inlineRow}>
        <strong>Total {total > 0 ? rupees(total) : 'Free'}</strong>
        {total > 0 && (
          <>
            <label className={styles.check}>
              <input type="radio" name={`${uid}-pay`} checked={form.payment === 'paid'} onChange={() => setForm((f) => ({ ...f, payment: 'paid' }))} /> Paid now
            </label>
            <label className={styles.check}>
              <input type="radio" name={`${uid}-pay`} checked={form.payment === 'pledge'} onChange={() => setForm((f) => ({ ...f, payment: 'pledge' }))} /> Will pay later
            </label>
            <label className={styles.check}>
              <input type="radio" name={`${uid}-pay`} checked={form.payment === 'txn'} onChange={() => setForm((f) => ({ ...f, payment: 'txn' }))} /> Paid by UPI
            </label>
          </>
        )}
      </div>
      {total > 0 && form.payment === 'txn' && (
        <Field label="Transaction ID" id={`${uid}-txn`} error={errors.txnRef}>
          <input id={`${uid}-txn`} value={form.txnRef} onChange={set('txnRef')} maxLength={100} />
        </Field>
      )}
      {mailEnabled && form.email && (
        <label className={styles.check}>
          <input type="checkbox" checked={form.sendEmail} onChange={set('sendEmail')} /> Email the coupons to {form.email}
        </label>
      )}
      {state.message && <p className={styles.formError}>{state.message}</p>}
      <div className={styles.formActions}>
        <Button type="submit" disabled={state.busy}>
          {state.busy ? 'Issuing…' : 'Issue coupons'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CouponLine({ coupon, registration, event, onReissue, onCancel }) {
  const [copied, setCopied] = useState(false);
  const text = couponShareText({ holder: registration.name, typeName: coupon.typeName?.en, quantity: coupon.quantity, eventTitle: event.title.en, url: coupon.url });
  const live = coupon.status === 'active';
  return (
    <li className={`${c.couponLine} ${live ? '' : c.couponDead}`}>
      <div className={c.couponMain}>
        <span className={c.couponType}>
          {coupon.typeName?.en || 'Coupon'} ×{coupon.quantity}
        </span>
        <code className={c.code}>{coupon.code}</code>
        {live ? (
          <span className={c.used} title={`${coupon.usedCount} of ${coupon.quantity} used`}>
            <span className={c.usedBar}>
              <span style={{ width: `${(coupon.usedCount / coupon.quantity) * 100}%` }} />
            </span>
            {coupon.usedCount}/{coupon.quantity} in
          </span>
        ) : (
          <span className={`${styles.badge} ${styles.badgeDraft}`}>
            {coupon.status === 'replaced' ? 'Replaced' : `Cancelled${coupon.cancelReason ? ` — ${coupon.cancelReason}` : ''}`}
          </span>
        )}
      </div>
      <div className={c.couponActions}>
        {live && (
          <>
            <button
              type="button"
              className={c.iconAction}
              onClick={async () => {
                setCopied(await copyText(coupon.url));
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy link'}
            </button>
            <a className={c.iconAction} href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" size={16} /> WhatsApp
            </a>
            <a className={c.iconAction} href={coupon.url} target="_blank" rel="noopener noreferrer">
              <Icon name="link" size={16} /> Open
            </a>
          </>
        )}
        {coupon.status !== 'replaced' && (
          <button type="button" className={c.iconAction} onClick={() => onReissue(coupon)} title="New code and link; the old link stops working">
            ↻ {live ? 'Reissue' : 'Restore'}
          </button>
        )}
        {live && (
          <button type="button" className={`${c.iconAction} ${c.dangerAction}`} onClick={() => onCancel(coupon)}>
            ✕ Cancel
          </button>
        )}
      </div>
    </li>
  );
}

export default function CouponPeoplePanel({ event, mailEnabled, onChange }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [attendance, setAttendance] = useState('all');
  const [payment, setPayment] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(null);

  const load = () => adminCouponsApi.registrations(event.id).then(setRows, setError);
  useEffect(() => {
    adminCouponsApi.registrations(event.id).then(setRows, setError);
  }, [event.id]);

  const counts = useMemo(() => {
    const out = { all: 0, none: 0, partial: 0, in: 0, cancelled: 0 };
    for (const r of rows || []) {
      out.all += 1;
      out[r.attendance] += 1;
    }
    return out;
  }, [rows]);

  const filtered = useMemo(
    () => (rows || []).filter((r) => (attendance === 'all' || r.attendance === attendance) && (payment === 'all' || r.paymentStatus === payment) && matches(r, query.trim())),
    [rows, attendance, payment, query],
  );

  const act = async (fn, message) => {
    try {
      const result = await fn();
      await load();
      onChange();
      if (message) setFlash(typeof message === 'function' ? message(result) : { text: message });
    } catch (err) {
      window.alert(err.message);
    }
  };

  const reissue = (registration) => (coupon) => {
    const verb = coupon.status === 'active' ? 'Reissue' : 'Restore';
    if (!window.confirm(`${verb} ${coupon.typeName?.en || 'coupon'} ×${coupon.quantity} for ${registration.name}? It gets a new code and link; the old link stops working.`)) return;
    act(
      () => adminCouponsApi.reissueCoupon(coupon.id),
      (fresh) => ({
        text: `New coupon for ${registration.name}: ${fresh.code}. Share the new link:`,
        url: fresh.url,
        share: couponShareText({ holder: registration.name, typeName: coupon.typeName?.en, quantity: fresh.quantity, eventTitle: event.title.en, url: fresh.url }),
      }),
    );
  };
  const cancel = (coupon) => {
    const reason = window.prompt(`Cancel ${coupon.typeName?.en || 'coupon'} ${coupon.code}? Optional reason (shown to the gate):`, '');
    if (reason === null) return;
    act(() => adminCouponsApi.cancelCoupon(coupon.id, reason), 'Coupon cancelled.');
  };

  if (error) return <ErrorState error={error} />;
  if (!rows) return <LoadingState lines={4} />;

  return (
    <div className={c.panel}>
      {flash && (
        <div className={c.flash} role="status">
          <p>{flash.text}</p>
          {flash.url && (
            <div className={c.couponActions}>
              <code className={c.code}>{flash.url}</code>
              <button type="button" className={c.iconAction} onClick={() => copyText(flash.url)}>
                <Icon name="copy" size={16} /> Copy
              </button>
              <a className={c.iconAction} href={whatsappUrl(flash.share)} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={16} /> WhatsApp
              </a>
            </div>
          )}
          <button type="button" className={styles.linkBtn} onClick={() => setFlash(null)}>
            Dismiss
          </button>
        </div>
      )}

      {adding ? (
        <WalkInForm
          event={event}
          mailEnabled={mailEnabled}
          onCancel={() => setAdding(false)}
          onDone={(result) => {
            setAdding(false);
            load();
            onChange();
            setFlash({
              text: `Issued ${result.coupons.map((x) => `${x.typeName?.en} ×${x.quantity} (${x.code})`).join(', ')} for ${result.registration.name}.`,
              url: result.coupons[0]?.url,
              share: couponShareText({ holder: result.registration.name, typeName: result.coupons[0]?.typeName?.en, quantity: result.coupons[0]?.quantity, eventTitle: event.title.en, url: result.coupons[0]?.url }),
            });
          }}
        />
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.chips} role="group" aria-label="Filter by attendance">
            {['all', 'none', 'partial', 'in', 'cancelled'].map((key) => (
              <button
                key={key}
                type="button"
                className={`${styles.chip} ${attendance === key ? styles.chipActive : ''}`}
                aria-pressed={attendance === key}
                onClick={() => setAttendance(key)}
              >
                {key === 'all' ? 'Everyone' : ATTENDANCE_LABELS[key]} <span className={styles.chipCount}>{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className={c.headActions}>
            {!adding && (
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                + Walk-in
              </Button>
            )}
            <Button size="sm" variant="secondary" href={adminCouponsApi.csvUrl(event.id)}>
              Download CSV
            </Button>
          </div>
        </div>
        <div className={styles.toolbarRow}>
          <label className={styles.search}>
            <span className="visually-hidden">Search</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email, code or transaction ID" />
          </label>
          <label className={styles.pageSize}>
            Payment
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="all">All</option>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 && <p className="muted">{rows.length ? 'Nobody matches these filters.' : 'No registrations yet.'}</p>}
      <ul className={c.people} role="list">
        {filtered.slice(0, limit).map((r) => (
          <li key={r.id} className={c.person}>
            <div className={c.personHead}>
              <div>
                <p className={c.personName}>
                  {r.name}
                  <span className={`${c.att} ${c[`att_${r.attendance}`]}`}>{ATTENDANCE_LABELS[r.attendance]}</span>
                  {r.source === 'admin' && <span className={`${styles.badge} ${styles.badgeDraft}`}>Walk-in</span>}
                </p>
                <p className={styles.rowMeta}>
                  {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>}
                  {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
                  <span>{r.attendees} {r.attendees === 1 ? 'person' : 'people'}</span>
                  <span>{formatWhen(r.createdAt)}</span>
                </p>
              </div>
              <div className={c.pay}>
                <strong>{r.amountDue ? rupees(r.amountDue) : 'Free'}</strong>
                {r.amountDue > 0 && (
                  <select
                    className={`${c.paySelect} ${c[`pay_${r.paymentStatus}`]}`}
                    value={r.paymentStatus}
                    aria-label={`Payment status for ${r.name}`}
                    onChange={(e) => act(() => adminCouponsApi.setPayment(r.id, e.target.value))}
                  >
                    {Object.entries(PAYMENT_LABELS)
                      .filter(([k]) => k !== 'free')
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                  </select>
                )}
                {r.txnRef && <span className={c.txn}>Txn: {r.txnRef}</span>}
              </div>
            </div>
            <ul className={c.couponList} role="list">
              {r.coupons.map((coupon) => (
                <CouponLine key={coupon.id} coupon={coupon} registration={r} event={event} onReissue={reissue(r)} onCancel={cancel} />
              ))}
            </ul>
            {r.adminNote && <p className={c.note}>{r.adminNote}</p>}
            <div className={c.personActions}>
              {mailEnabled && r.email && (
                <button type="button" className={styles.linkBtn} onClick={() => act(() => adminCouponsApi.resend(r.id), `Coupons emailed to ${r.email}.`)}>
                  {r.emailSentAt ? 'Email again' : 'Email coupons'}
                </button>
              )}
              {r.coupons.some((x) => x.status === 'active') && (
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    const reason = window.prompt(`Cancel all coupons for ${r.name}? Optional reason:`, '');
                    if (reason !== null) act(() => adminCouponsApi.cancelRegistration(r.id, reason), 'Registration cancelled.');
                  }}
                >
                  Cancel registration
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > limit && (
        <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
          Show more ({filtered.length - limit} more)
        </Button>
      )}
    </div>
  );
}
