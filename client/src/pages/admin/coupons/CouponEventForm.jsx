import { useEffect, useId, useRef, useState } from 'react';
import { fromLocalInput, toLocalInput } from '../../../components/coupons/couponUtils.js';
import Button from '../../../components/ui/Button.jsx';
import { adminApi, contentApi } from '../../../services/api.js';
import styles from '../Admin.module.css';
import { Field } from './formKit.jsx';
import { makeBinder } from './formUtils.js';

/** Field names for the error summary, so a problem is findable even when it's scrolled out of view. */
const FIELD_LABELS = {
  'title.en': 'Event name',
  slug: 'Link name',
  linkedEventSlug: 'Website event',
  startsAt: 'Starts',
  endsAt: 'Ends',
  registrationClosesAt: 'Registrations close',
  linksExpireAt: 'Coupon links stop working',
  totalQuota: 'Total coupons',
  maxAttendees: 'Most people per registration',
  'venue.mapUrl': 'Google Maps link',
  'payment.upiId': 'UPI ID',
  'payment.allowPledge': 'Payment',
  'contact.phone': 'Help contact phone',
};

const EMPTY = {
  title: { en: '', bn: '' },
  tagline: { en: '', bn: '' },
  description: { en: '', bn: '' },
  slug: '',
  status: 'draft',
  startsAt: '',
  endsAt: '',
  registrationClosesAt: '',
  linksExpireAt: '',
  totalQuota: 500,
  maxAttendees: 10,
  venue: { name: '', address: '', mapUrl: '' },
  linkedEventSlug: '',
  payment: { upiId: '', payeeName: 'Parbon Sanskritik Samity', note: '', allowTxn: true, allowPledge: true },
  contact: { name: '', phone: '' },
};

const DATE_FIELDS = ['startsAt', 'endsAt', 'registrationClosesAt', 'linksExpireAt'];

function fromEvent(e) {
  const form = {
    ...EMPTY,
    ...e,
    title: { ...EMPTY.title, ...e.title },
    tagline: { ...EMPTY.tagline, ...e.tagline },
    description: { ...EMPTY.description, ...e.description },
    venue: { ...EMPTY.venue, ...e.venue },
    payment: { ...EMPTY.payment, ...e.payment },
    contact: { ...EMPTY.contact, ...e.contact },
    linkedEventSlug: e.linkedEventSlug || '',
  };
  for (const key of DATE_FIELDS) form[key] = toLocalInput(e[key]);
  // "Links expire" equal to the end time is the default; show it empty so it follows the end time.
  if (e.linksExpireAt === e.endsAt) form.linksExpireAt = '';
  return form;
}

function toPayload(form) {
  const payload = { ...form, totalQuota: Number(form.totalQuota), maxAttendees: Number(form.maxAttendees) };
  for (const key of DATE_FIELDS) payload[key] = fromLocalInput(form[key]);
  for (const key of ['id', 'createdAt', 'updatedAt', 'types', 'stats', 'registration']) delete payload[key];
  return payload;
}

export default function CouponEventForm({ event, preset, onSaved, onDelete, save, submitLabel, siteEvents: givenSiteEvents, onErrors, describeKey }) {
  const uid = useId();
  const formRef = useRef(null);
  const [form, setForm] = useState(() => (event ? fromEvent(event) : preset ? fromEvent({ ...EMPTY, ...preset }) : EMPTY));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, message: '', ok: '', attempt: 0 });
  const [loadedSiteEvents, setSiteEvents] = useState([]);
  const siteEvents = givenSiteEvents || loadedSiteEvents;
  const bind = makeBinder(form, setForm, errors, uid);

  useEffect(() => {
    // Every website event, including drafts, so coupons can be set up before the event page is published.
    if (!givenSiteEvents) adminApi.events().then(setSiteEvents, () => contentApi.events().then(setSiteEvents, () => {}));
    if (event) return;
    contentApi.support().then((support) => {
      const upi = support?.donation?.methods?.find((m) => m.type === 'upi');
      if (upi) setForm((f) => ({ ...f, payment: { ...f.payment, upiId: f.payment.upiId || upi.upiId, payeeName: upi.payeeName || f.payment.payeeName } }));
    }, () => {});
  }, [event, givenSiteEvents]);

  // After a failed save, bring the first problem into view: a highlighted field in this form,
  // otherwise the coupon types above it, otherwise the message.
  useEffect(() => {
    if (!state.attempt || !state.message) return;
    const root = formRef.current;
    const target = root?.querySelector('[aria-invalid="true"]') || document.querySelector('#preset-types [aria-invalid="true"]') || root?.querySelector('[role="alert"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof target.focus === 'function' && target.matches('input, select, textarea')) target.focus({ preventScroll: true });
  }, [state.attempt, state.message]);

  const submit = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, busy: true, message: '', ok: '' }));
    setErrors({});
    onErrors?.({});
    try {
      const saved = await save(toPayload(form));
      setForm(fromEvent(saved));
      setState((s) => ({ ...s, busy: false, message: '', ok: 'Saved.' }));
      onSaved?.(saved);
    } catch (err) {
      setErrors(err.fields || {});
      onErrors?.(err.fields || {});
      setState((s) => ({ busy: false, message: err.message, ok: '', attempt: s.attempt + 1 }));
    }
  };

  const summary = Object.entries(errors).map(([key, message]) => {
    const label = FIELD_LABELS[key] || describeKey?.(key) || null;
    return label ? `${label}: ${message}` : message;
  });

  const check = (path) => ({
    checked: path.split('.').reduce((o, k) => o?.[k], form) !== false,
    onChange: (e) => setForm((f) => ({ ...f, payment: { ...f.payment, [path.split('.')[1]]: e.target.checked } })),
  });

  return (
    <form className={styles.form} onSubmit={submit} noValidate ref={formRef}>
      <fieldset className={styles.group}>
        <legend>Event</legend>
        <Field
          label="Website event"
          id={bind('linkedEventSlug').id}
          error={errors.linkedEventSlug}
          hint="The event on the website these coupons are for. Its page gets a “Get your coupons” button. Optional."
        >
          <select {...bind('linkedEventSlug')}>
            <option value="">— Not linked to a website event —</option>
            {siteEvents.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title.en}
                {s.startDate ? ` · ${s.startDate}` : ''}
                {s.state === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
            {form.linkedEventSlug && !siteEvents.some((s) => s.slug === form.linkedEventSlug) && <option value={form.linkedEventSlug}>{form.linkedEventSlug}</option>}
          </select>
        </Field>
        <Field label="Event name (English)" id={bind('title.en').id} error={errors['title.en']} required>
          <input {...bind('title.en')} maxLength={140} required placeholder="Durga Puja 2026" />
        </Field>
        <Field label="Event name (Bengali)" id={bind('title.bn').id}>
          <input {...bind('title.bn')} maxLength={140} lang="bn" placeholder="শারদীয়া দুর্গোৎসব ২০২৬" />
        </Field>
        <Field label="Short line under the name" id={bind('tagline.en').id} hint="Optional, e.g. “Five days of dhak, bhog and adda”.">
          <input {...bind('tagline.en')} maxLength={200} />
        </Field>
        <Field label="About the event" id={bind('description.en').id} hint="Shown on the registration page. Line breaks work.">
          <textarea {...bind('description.en')} rows={4} maxLength={3000} />
        </Field>
        <Field
          label="Link name"
          id={bind('slug').id}
          error={errors.slug}
          hint={`The registration page will be ${window.location.origin}/register/${form.slug || '…'} — leave empty to make one from the name.`}
        >
          <input {...bind('slug')} maxLength={70} pattern="[a-z0-9-]*" placeholder="durga-puja-2026" />
        </Field>
        <Field label="Registrations" id={bind('status').id} hint="Draft: only you can see it. Open: people can register. Closed: no new registrations.">
          <select {...bind('status')}>
            <option value="draft">Draft — not public yet</option>
            <option value="open">Open — taking registrations</option>
            <option value="closed">Closed — no new registrations</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>When</legend>
        <div className={styles.row2}>
          <Field label="Starts" id={bind('startsAt').id} error={errors.startsAt} required>
            <input type="datetime-local" {...bind('startsAt')} required />
          </Field>
          <Field label="Ends" id={bind('endsAt').id} error={errors.endsAt} required>
            <input type="datetime-local" {...bind('endsAt')} required />
          </Field>
          <Field label="Registrations close" id={bind('registrationClosesAt').id} error={errors.registrationClosesAt} hint="Optional. Otherwise open until the event ends.">
            <input type="datetime-local" {...bind('registrationClosesAt')} />
          </Field>
          <Field label="Coupon links stop working" id={bind('linksExpireAt').id} error={errors.linksExpireAt} hint="Optional. Otherwise when the event ends.">
            <input type="datetime-local" {...bind('linksExpireAt')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>How many</legend>
        <div className={styles.row2}>
          <Field label="Total coupons for this event" id={bind('totalQuota').id} error={errors.totalQuota} hint="All coupon types together, e.g. 500." required>
            <input type="number" min="1" max="100000" inputMode="numeric" {...bind('totalQuota')} required />
          </Field>
          <Field label="Most people per registration" id={bind('maxAttendees').id} error={errors.maxAttendees}>
            <input type="number" min="1" max="100" inputMode="numeric" {...bind('maxAttendees')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Where</legend>
        <Field label="Venue" id={bind('venue.name').id}>
          <input {...bind('venue.name')} maxLength={140} placeholder="Nirusa Banquets — on the terrace" />
        </Field>
        <Field label="Address" id={bind('venue.address').id}>
          <input {...bind('venue.address')} maxLength={300} />
        </Field>
        <Field label="Google Maps link" id={bind('venue.mapUrl').id} error={errors['venue.mapUrl']}>
          <input type="url" {...bind('venue.mapUrl')} maxLength={500} placeholder="https://maps.app.goo.gl/…" />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Payment</legend>
        <label className={styles.check}>
          <input type="checkbox" {...check('payment.allowTxn')} /> People can pay online (UPI) and enter the transaction ID
        </label>
        <label className={styles.check}>
          <input type="checkbox" {...check('payment.allowPledge')} /> People can choose “I’ll pay at the counter”
        </label>
        {errors['payment.allowPledge'] && <p className={styles.fieldError}>{errors['payment.allowPledge']}</p>}
        <div className={styles.row2}>
          <Field label="UPI ID" id={bind('payment.upiId').id} error={errors['payment.upiId']}>
            <input {...bind('payment.upiId')} maxLength={130} placeholder="name@bank" />
          </Field>
          <Field label="Payee name" id={bind('payment.payeeName').id}>
            <input {...bind('payment.payeeName')} maxLength={100} />
          </Field>
        </div>
        <Field label="Payment note" id={bind('payment.note').id} hint="Optional, shown with the payment options — e.g. “Mention your name in the UPI note”.">
          <textarea {...bind('payment.note')} rows={2} maxLength={600} />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Help contact (optional)</legend>
        <div className={styles.row2}>
          <Field label="Name" id={bind('contact.name').id}>
            <input {...bind('contact.name')} maxLength={100} />
          </Field>
          <Field label="Phone" id={bind('contact.phone').id} error={errors['contact.phone']}>
            <input type="tel" {...bind('contact.phone')} maxLength={20} />
          </Field>
        </div>
      </fieldset>

      {state.message && (
        <div className={styles.formError} role="alert">
          <p>{summary.length ? 'Please fix the following, then try again:' : state.message}</p>
          {summary.length > 0 && (
            <ul>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.ok && (
        <p className={styles.notice} role="status">
          {state.ok}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" disabled={state.busy}>
          {state.busy ? 'Saving…' : event ? 'Save changes' : submitLabel || 'Create event'}
        </Button>
        {onDelete && (
          <Button variant="secondary" onClick={onDelete}>
            Delete event
          </Button>
        )}
      </div>
    </form>
  );
}
