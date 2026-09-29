import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { copyText, couponShareText, formatWhen, rupees, whatsappUrl } from '../../components/coupons/couponUtils.js';
import { eventDateText, eventTimeText } from '../../components/coupons/designSpec.js';
import QrCode from '../../components/coupons/QrCode.jsx';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { couponsApi } from '../../services/api.js';
import NotFound from '../NotFound.jsx';
import styles from './Register.module.css';

const storeKey = (slug) => `parbon.coupons.${slug}`;
const remembered = (slug) => {
  try {
    return JSON.parse(localStorage.getItem(storeKey(slug)) || '[]');
  } catch {
    return [];
  }
};
const remember = (slug, result) => {
  try {
    localStorage.setItem(storeKey(slug), JSON.stringify([result, ...remembered(slug)].slice(0, 10)));
  } catch {
    // Private browsing: nothing to do — the links are also on screen and can be shared.
  }
};

const upiLink = (payment, amount, note) =>
  `upi://pay?pa=${payment.upiId}&pn=${encodeURIComponent(payment.payeeName || 'Parbon Sanskritik Samity')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note).slice(0, 80)}`;

function Stepper({ value, onChange, min = 0, max, label, id }) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        aria-label={label}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}

function IssuedCoupons({ result, event, onAnother }) {
  const [copied, setCopied] = useState('');
  const all = result.coupons
    .map((c) => `• ${c.typeName?.en || 'Coupon'} ×${c.quantity}: ${c.url}`)
    .join('\n');
  const shareAll = `🪔 ${event.title.en} — coupons for ${result.registration.name}\n${all}\nShow the QR code at the entrance.`;
  const paymentNote = {
    to_verify: 'Thank you! We’ll check your payment against the transaction ID.',
    pledged: `Please pay ${rupees(result.registration.amountDue)} at the counter when you arrive.`,
    free: '',
    paid: 'Payment received — thank you!',
  }[result.registration.paymentStatus];

  return (
    <div className={styles.done} id="coupons-issued">
      <div className={styles.doneHead}>
        <Icon name="check" size={40} strokeWidth={2} />
        <div>
          <h2>
            <span lang="bn">ধন্যবাদ!</span> Your coupons are ready
          </h2>
          <p>
            Save these links — each one opens a coupon with a QR code to show at the entrance.
            {result.emailed && ' We’ve also emailed them to you.'}
          </p>
        </div>
      </div>
      {paymentNote && <p className={styles.payNote}>{paymentNote}</p>}
      <ul className={styles.issued} role="list">
        {result.coupons.map((c) => {
          const text = couponShareText({ holder: result.registration.name, typeName: c.typeName?.en, quantity: c.quantity, eventTitle: event.title.en, url: c.url });
          return (
            <li key={c.token} className={styles.ticket}>
              <div className={styles.ticketMain}>
                <p className={styles.ticketType}>
                  {c.typeName?.en || 'Coupon'} <span>×{c.quantity}</span>
                </p>
                <p className={styles.ticketCode}>{c.code}</p>
              </div>
              <div className={styles.ticketActions}>
                <Button to={`/c/${c.token}`} size="sm" arrow>
                  Open coupon
                </Button>
                <a className={styles.pill} href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" size={18} /> WhatsApp
                </a>
                <button
                  type="button"
                  className={styles.pill}
                  onClick={async () => {
                    if (await copyText(c.url)) setCopied(c.token);
                    setTimeout(() => setCopied(''), 1800);
                  }}
                >
                  <Icon name={copied === c.token ? 'check' : 'copy'} size={18} /> {copied === c.token ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {result.coupons.length > 1 && (
        <Button href={whatsappUrl(shareAll)} variant="secondary">
          Send all links to myself on WhatsApp
        </Button>
      )}
      <p className={styles.small}>
        Keep the links private — anyone with a link can use the coupon. They stop working after the event. Lost them? Open this page again on the
        same phone, or contact us.
      </p>
      <button type="button" className={styles.linkBtn} onClick={onAnother}>
        Register someone else
      </button>
    </div>
  );
}

function OpenEvents() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    couponsApi.openEvents().then(setEvents, setError);
  }, []);
  return (
    <>
      <Seo title="Register for an event" description="Register for Parbon events and get your coupons online." />
      <section className={styles.hero}>
        <div className="container-narrow">
          <p className={styles.eyebrow}>Coupons</p>
          <h1 id="page-title" className={styles.title}>
            <span lang="bn">নিবন্ধন</span> Register for an event
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container-narrow">
          {error && <ErrorState error={error} />}
          {!events && !error && <LoadingState />}
          {events?.length === 0 && <EmptyState title={{ bn: 'শীঘ্রই আসছে', en: 'Nothing open right now' }} text={{ en: 'Registrations will appear here when they open.' }} />}
          <ul className={styles.eventList} role="list">
            {events?.map((e) => (
              <li key={e.slug}>
                <Link to={`/register/${e.slug}`} className={styles.eventLink}>
                  <strong>{e.title.en}</strong>
                  <span>
                    {eventDateText(e.startsAt, e.endsAt)}
                    {e.venue?.name ? ` · ${e.venue.name}` : ''}
                  </span>
                  <Icon name="arrow" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

export default function Register() {
  const { slug } = useParams();
  if (!slug) return <OpenEvents />;
  return <RegisterForEvent key={slug} slug={slug} />;
}

function RegisterForEvent({ slug }) {
  const uid = useId();
  const [event, setEvent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', attendees: 1, website: '', paymentMethod: '', txnRef: '', sendEmail: true });
  const [qty, setQty] = useState({});
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, message: '' });
  const [result, setResult] = useState(null);
  const [earlier, setEarlier] = useState(() => remembered(slug));
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    couponsApi.event(slug).then(setEvent, setLoadError);
  }, [slug]);

  const types = useMemo(() => event?.types || [], [event]);
  const maxFor = (t) => Math.max(0, Math.min(t.maxPerRegistration, t.remaining ?? t.maxPerRegistration));
  // Until someone changes it, the entry pass count follows the number of people.
  const quantityOf = (t) => {
    if (touched[t.id] || t.kind !== 'entry') return qty[t.id] || 0;
    return Math.min(form.attendees, maxFor(t));
  };
  const total = types.reduce((sum, t) => sum + quantityOf(t) * t.price, 0);
  const count = types.reduce((sum, t) => sum + quantityOf(t), 0);

  if (loadError?.status === 404) return <NotFound />;
  if (loadError) {
    return (
      <div className="container section">
        <ErrorState error={loadError} />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="container section">
        <LoadingState lines={6} />
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const fieldProps = (key) => ({
    id: `${uid}-${key}`,
    value: form[key],
    onChange: set(key),
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-error` : undefined,
  });
  const err = (key) =>
    errors[key] && (
      <p className={styles.error} id={`${uid}-${key}-error`}>
        {errors[key]}
      </p>
    );

  const payment = event.payment || {};
  const needsPayment = total > 0;
  const method = needsPayment ? form.paymentMethod || (payment.allowTxn !== false ? '' : 'pledge') : 'free';

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, message: '' });
    setErrors({});
    try {
      const res = await couponsApi.register(slug, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        attendees: Number(form.attendees),
        items: types.map((t) => ({ typeId: t.id, quantity: quantityOf(t) })),
        paymentMethod: method,
        txnRef: form.txnRef,
        sendEmail: event.mailEnabled && form.sendEmail,
        website: form.website,
      });
      remember(slug, { ...res, at: new Date().toISOString() });
      setEarlier(remembered(slug));
      setResult(res);
      requestAnimationFrame(() => document.getElementById('coupons-issued')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      setErrors(error.fields || {});
      setState({ busy: false, message: error.message });
      couponsApi.event(slug).then(setEvent, () => {});
      return;
    }
    setState({ busy: false, message: '' });
  };

  const closedText = { closed: 'Registrations for this event are closed.', over: 'This event is over.' }[event.registration];
  const soldOut = event.registration === 'open' && event.remaining <= 0;

  return (
    <>
      <Seo title={`Register — ${event.title.en}`} description={event.tagline?.en || `Register for ${event.title.en} and get your coupons online.`} />
      <section className={styles.hero}>
        <div className="container-narrow">
          <p className={styles.eyebrow}>Registration · নিবন্ধন</p>
          <h1 id="page-title" className={styles.title}>
            {event.title.bn && (
              <span lang="bn" className={styles.titleBn}>
                {event.title.bn}
              </span>
            )}
            <span>{event.title.en}</span>
          </h1>
          {event.tagline?.en && <p className={styles.tagline}>{event.tagline.en}</p>}
          <dl className={styles.facts}>
            <div>
              <dt>
                <Icon name="calendar" size={18} /> When
              </dt>
              <dd>
                {eventDateText(event.startsAt, event.endsAt)}
                <span>{eventTimeText(event.startsAt, event.endsAt)}</span>
              </dd>
            </div>
            {event.venue?.name && (
              <div>
                <dt>
                  <Icon name="pin" size={18} /> Where
                </dt>
                <dd>
                  {event.venue.mapUrl ? (
                    <a href={event.venue.mapUrl} target="_blank" rel="noopener noreferrer">
                      {event.venue.name}
                    </a>
                  ) : (
                    event.venue.name
                  )}
                  {event.venue.address && <span>{event.venue.address}</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <section className="section" aria-label="Register">
        <div className="container-narrow">
          {result ? (
            <IssuedCoupons result={result} event={event} onAnother={() => { setResult(null); setForm((f) => ({ ...f, name: '', txnRef: '' })); setQty({}); setTouched({}); }} />
          ) : closedText || soldOut ? (
            <div className={styles.closed}>
              <Icon name="lotus" size={40} />
              <p>{soldOut ? 'All coupons for this event have been taken. Thank you for the love!' : closedText}</p>
              {event.contact?.phone && (
                <p>
                  Questions? Call {event.contact.name || 'us'} on <a href={`tel:${event.contact.phone.replace(/[^\d+]/g, '')}`}>{event.contact.phone}</a>.
                </p>
              )}
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              {event.description?.en && <p className={styles.about}>{event.description.en}</p>}

              <fieldset className={styles.step}>
                <legend>
                  <span className={styles.stepNo}>1</span> Your details
                </legend>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-name`}>Full name</label>
                  <input {...fieldProps('name')} autoComplete="name" maxLength={120} required />
                  {err('name')}
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label htmlFor={`${uid}-phone`}>Mobile number</label>
                    <input {...fieldProps('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+91 98765 43210" required />
                    {err('phone')}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`${uid}-email`}>Email</label>
                    <input {...fieldProps('email')} type="email" inputMode="email" autoComplete="email" maxLength={200} required />
                    {err('email')}
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-attendees`}>How many people are coming (including you)?</label>
                  <Stepper id={`${uid}-attendees`} value={Number(form.attendees)} min={1} max={event.maxAttendees} label="people" onChange={(v) => setForm((f) => ({ ...f, attendees: v }))} />
                  {err('attendees')}
                </div>
                {/* Honeypot for bots — hidden from people and screen readers. */}
                <div className={styles.hp} aria-hidden="true">
                  <label htmlFor={`${uid}-website`}>Website</label>
                  <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </div>
              </fieldset>

              <fieldset className={styles.step}>
                <legend>
                  <span className={styles.stepNo}>2</span> Choose your coupons
                </legend>
                <ul className={styles.types} role="list">
                  {types.map((t) => {
                    const max = maxFor(t);
                    const q = quantityOf(t);
                    return (
                      <li key={t.id} className={`${styles.type} ${q > 0 ? styles.typeOn : ''} ${max === 0 ? styles.typeOut : ''}`}>
                        <span className={styles.typeIcon} aria-hidden="true">
                          <Icon name={t.kind === 'food' ? 'bhog' : t.kind === 'entry' ? 'dhak' : 'lotus'} size={28} />
                        </span>
                        <div className={styles.typeText}>
                          <p className={styles.typeName}>
                            {t.name.en} {t.name.bn && <span lang="bn">{t.name.bn}</span>}
                          </p>
                          {t.description?.en && <p className={styles.typeDesc}>{t.description.en}</p>}
                          <p className={styles.typeMeta}>
                            <strong>{t.price ? `${rupees(t.price)} each` : 'Free'}</strong>
                            {max === 0 ? <span className={styles.out}>Sold out</span> : t.remaining !== null && t.remaining <= 20 && <span className={styles.few}>Only {t.remaining} left</span>}
                          </p>
                          {err(`items.${t.id}`)}
                        </div>
                        <Stepper
                          value={q}
                          max={max}
                          label={t.name.en}
                          onChange={(v) => {
                            setTouched((x) => ({ ...x, [t.id]: true }));
                            setQty((x) => ({ ...x, [t.id]: v }));
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
                {err('items')}
              </fieldset>

              <fieldset className={styles.step}>
                <legend>
                  <span className={styles.stepNo}>3</span> {needsPayment ? 'Payment' : 'Confirm'}
                </legend>
                <p className={styles.total}>
                  <span>
                    {count} coupon{count === 1 ? '' : 's'}
                  </span>
                  <strong>{needsPayment ? rupees(total) : 'Free'}</strong>
                </p>
                {needsPayment && (
                  <>
                    <div className={styles.payOptions} role="radiogroup" aria-label="How will you pay?">
                      {payment.allowTxn !== false && (
                        <label className={`${styles.payOption} ${method === 'txn' ? styles.payOn : ''}`}>
                          <input type="radio" name={`${uid}-pay`} checked={method === 'txn'} onChange={() => setForm((f) => ({ ...f, paymentMethod: 'txn' }))} />
                          <span>
                            <strong>I’ve paid online (UPI)</strong>
                            <small>Pay now, then enter the transaction ID</small>
                          </span>
                        </label>
                      )}
                      {payment.allowPledge !== false && (
                        <label className={`${styles.payOption} ${method === 'pledge' ? styles.payOn : ''}`}>
                          <input type="radio" name={`${uid}-pay`} checked={method === 'pledge'} onChange={() => setForm((f) => ({ ...f, paymentMethod: 'pledge' }))} />
                          <span>
                            <strong>I’ll pay at the counter</strong>
                            <small>Cash or UPI when you arrive</small>
                          </span>
                        </label>
                      )}
                    </div>
                    {err('paymentMethod')}
                    {method === 'txn' && (
                      <div className={styles.upi}>
                        {payment.upiId ? (
                          <>
                            <div className={styles.upiQr}>
                              <QrCode value={upiLink(payment, total, `${event.title.en} coupons — ${form.name || 'registration'}`)} title={`UPI QR code to pay ${rupees(total)}`} />
                            </div>
                            <div className={styles.upiText}>
                              <p>
                                Scan with any UPI app to pay <strong>{rupees(total)}</strong>, or pay to:
                              </p>
                              <p className={styles.upiId}>
                                <code>{payment.upiId}</code>
                                <button
                                  type="button"
                                  className={styles.pill}
                                  onClick={async () => {
                                    setCopiedUpi(await copyText(payment.upiId));
                                    setTimeout(() => setCopiedUpi(false), 1600);
                                  }}
                                >
                                  <Icon name={copiedUpi ? 'check' : 'copy'} size={16} /> {copiedUpi ? 'Copied' : 'Copy'}
                                </button>
                              </p>
                              <a className={styles.upiApp} href={upiLink(payment, total, `${event.title.en} coupons`)}>
                                Open my UPI app →
                              </a>
                            </div>
                          </>
                        ) : (
                          <p>Please pay using the details shared by the committee.</p>
                        )}
                        {payment.note && <p className={styles.small}>{payment.note}</p>}
                        <div className={styles.field}>
                          <label htmlFor={`${uid}-txnRef`}>UPI transaction ID / UTR</label>
                          <input {...fieldProps('txnRef')} maxLength={100} autoComplete="off" placeholder="e.g. 427613589012" />
                          {err('txnRef')}
                        </div>
                      </div>
                    )}
                    {method === 'pledge' && payment.note && <p className={styles.small}>{payment.note}</p>}
                  </>
                )}
                {event.mailEnabled && (
                  <label className={styles.check}>
                    <input type="checkbox" checked={form.sendEmail} onChange={set('sendEmail')} /> Also email me my coupons
                  </label>
                )}
              </fieldset>

              {state.message && (
                <p className={styles.formError} role="alert">
                  {state.message}
                </p>
              )}
              <Button type="submit" size="lg" disabled={state.busy || count === 0} arrow>
                {state.busy ? 'Getting your coupons…' : 'Get my coupons'}
              </Button>
              <p className={styles.small}>
                We use your details only for this event. Your coupons will open right here, ready to share on WhatsApp.
              </p>
            </form>
          )}

          {earlier.length > 0 && !result && (
            <div className={styles.earlier}>
              <h2>Coupons you got on this device</h2>
              <ul role="list">
                {earlier.map((r) =>
                  r.coupons.map((c) => (
                    <li key={c.token}>
                      <Link to={`/c/${c.token}`}>
                        {r.registration.name} — {c.typeName?.en || 'Coupon'} ×{c.quantity}
                      </Link>{' '}
                      <span className={styles.small}>{formatWhen(r.at)}</span>
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
