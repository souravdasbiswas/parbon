import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import CouponArt from '../../components/coupons/CouponArt.jsx';
import { copyText, couponShareText, rupees, whatsappUrl } from '../../components/coupons/couponUtils.js';
import { couponFieldData, eventDateText, eventTimeText } from '../../components/coupons/designSpec.js';
import QrCode from '../../components/coupons/QrCode.jsx';
import { designOrTemplate } from '../../components/coupons/templates.js';
import Icon from '../../components/motifs/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { couponsApi } from '../../services/api.js';
import styles from './CouponView.module.css';

const PAYMENT = {
  to_verify: { text: 'Payment being verified', tone: 'wait' },
  pledged: { text: 'Pay at the counter', tone: 'wait' },
  paid: { text: 'Paid', tone: 'ok' },
  free: { text: 'Free', tone: 'ok' },
  rejected: { text: 'Payment not confirmed — please contact us', tone: 'bad' },
};

function Message({ icon = 'lotus', title, children }) {
  return (
    <div className={styles.message}>
      <Icon name={icon} size={44} />
      <h1 id="page-title">{title}</h1>
      {children}
    </div>
  );
}

export default function CouponView() {
  const { token } = useParams();
  const [coupon, setCoupon] = useState(null);
  const [error, setError] = useState(null);
  const [bigQr, setBigQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const artRef = useRef(null);

  const load = useCallback(() => couponsApi.coupon(token).then(setCoupon, setError), [token]);

  useEffect(() => {
    load();
    // Check-ins happen on another device; refresh when the person comes back to this tab.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  if (error) {
    return (
      <section className="section">
        <div className="container-narrow">
          <Seo title="Coupon" noindex />
          {error.status === 410 ? (
            <Message title="This event is over">
              <p>Coupon links stop working after the event. Thank you for celebrating with us!</p>
              <p lang="bn" className={styles.bn}>
                আবার দেখা হবে!
              </p>
              <Button to="/" variant="secondary">
                Back to Parbon
              </Button>
            </Message>
          ) : error.status === 404 ? (
            <Message icon="close" title="Coupon not found">
              <p>This link isn’t valid. Please check that you copied the whole link, or ask the person who sent it.</p>
            </Message>
          ) : (
            <ErrorState error={error} onRetry={() => { setError(null); load(); }} />
          )}
        </div>
      </section>
    );
  }
  if (!coupon) {
    return (
      <section className="section">
        <div className="container-narrow">
          <LoadingState lines={6} />
        </div>
      </section>
    );
  }

  const title = coupon.event.title.en;
  if (coupon.status !== 'active') {
    return (
      <section className="section">
        <div className="container-narrow">
          <Seo title="Coupon" noindex />
          <Message icon="close" title={coupon.status === 'replaced' ? 'This coupon was replaced' : 'This coupon was cancelled'}>
            <p>
              {coupon.status === 'replaced'
                ? 'A newer coupon was issued in its place. Please use the latest link you received.'
                : 'It can no longer be used. If you think this is a mistake, please contact the committee.'}
            </p>
            {coupon.event.contact?.phone && (
              <p>
                Contact {coupon.event.contact.name || 'us'}: <a href={`tel:${coupon.event.contact.phone.replace(/[^\d+]/g, '')}`}>{coupon.event.contact.phone}</a>
              </p>
            )}
          </Message>
        </div>
      </section>
    );
  }

  const data = couponFieldData({ holder: coupon.holder, event: coupon.event, type: coupon.type, quantity: coupon.quantity, code: coupon.code, url: coupon.url });
  const design = designOrTemplate(coupon.type);
  const pay = PAYMENT[coupon.paymentStatus] || PAYMENT.free;
  const allIn = coupon.remaining === 0;
  const isEntry = coupon.type.kind !== 'food';
  const share = couponShareText({ holder: coupon.holder, typeName: coupon.type.name.en, quantity: coupon.quantity, eventTitle: title, url: coupon.url });

  const saveImage = async () => {
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(artRef.current, { pixelRatio: 2, width: design.width, height: design.height, style: { transform: 'none' }, cacheBust: true });
      const a = Object.assign(document.createElement('a'), { href: url, download: `parbon-${coupon.code}.png` });
      a.click();
    } catch {
      window.alert('Could not save the image on this device. Take a screenshot instead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Seo title={`${coupon.type.name.en} — ${title}`} noindex />
      <section className={styles.page} aria-labelledby="page-title">
        <div className={styles.inner}>
          <h1 id="page-title" className="visually-hidden">
            {coupon.type.name.en} for {title}
          </h1>

          <div className={styles.art}>
            <CouponArt design={design} data={data} artRef={artRef} label={`${coupon.type.name.en} ×${coupon.quantity} for ${coupon.holder}, code ${coupon.code}`} />
          </div>

          <div className={styles.status}>
            <div className={`${styles.admit} ${allIn ? styles.admitDone : ''}`}>
              <strong>{allIn ? (isEntry ? 'All checked in' : 'All used') : isEntry ? `Admits ${coupon.remaining}` : `${coupon.remaining} to use`}</strong>
              <span>
                {coupon.usedCount > 0 ? `${coupon.usedCount} of ${coupon.quantity} already used` : `${coupon.type.name.en} ×${coupon.quantity}`}
              </span>
            </div>
            <div className={`${styles.pay} ${styles[`tone_${pay.tone}`]}`}>
              <strong>{pay.text}</strong>
              {coupon.amountDue > 0 && <span>{rupees(coupon.amountDue)}</span>}
            </div>
          </div>

          <Button onClick={() => setBigQr(true)} size="lg" className={styles.showQr}>
            {isEntry ? 'Show QR at the entrance' : 'Show QR at the counter'}
          </Button>

          <div className={styles.actions}>
            <a className={styles.pill} href={whatsappUrl(share)} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" size={18} /> Share on WhatsApp
            </a>
            <button
              type="button"
              className={styles.pill}
              onClick={async () => {
                setCopied(await copyText(coupon.url));
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button type="button" className={styles.pill} onClick={saveImage} disabled={saving}>
              ⤓ {saving ? 'Saving…' : 'Save image'}
            </button>
          </div>

          <dl className={styles.facts}>
            <div>
              <dt>
                <Icon name="calendar" size={18} /> When
              </dt>
              <dd>
                {eventDateText(coupon.event.startsAt, coupon.event.endsAt)}
                <span>{eventTimeText(coupon.event.startsAt, coupon.event.endsAt)}</span>
              </dd>
            </div>
            {coupon.event.venue?.name && (
              <div>
                <dt>
                  <Icon name="pin" size={18} /> Where
                </dt>
                <dd>
                  {coupon.event.venue.mapUrl ? (
                    <a href={coupon.event.venue.mapUrl} target="_blank" rel="noopener noreferrer">
                      {coupon.event.venue.name} ↗
                    </a>
                  ) : (
                    coupon.event.venue.name
                  )}
                  {coupon.event.venue.address && <span>{coupon.event.venue.address}</span>}
                </dd>
              </div>
            )}
            {coupon.event.contact?.phone && (
              <div>
                <dt>
                  <Icon name="phone" size={18} /> Help
                </dt>
                <dd>
                  <a href={`tel:${coupon.event.contact.phone.replace(/[^\d+]/g, '')}`}>{coupon.event.contact.phone}</a>
                  {coupon.event.contact.name && <span>{coupon.event.contact.name}</span>}
                </dd>
              </div>
            )}
          </dl>
          <p className={styles.small}>
            Tip: turn your screen brightness up at the gate. This link is your coupon — share it only with the people it’s for. It stops working after
            the event.
          </p>
        </div>
      </section>

      {bigQr && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Coupon QR code" onClick={() => setBigQr(false)}>
          <div className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
            <p className={styles.overlayTitle}>
              {coupon.type.name.en} ×{coupon.quantity}
            </p>
            <div className={styles.bigQr}>
              <QrCode value={coupon.url} padding={12} />
            </div>
            <p className={styles.bigCode}>{coupon.code}</p>
            <p className={styles.overlayName}>{coupon.holder}</p>
            <Button variant="secondary" onClick={() => setBigQr(false)} autoFocus>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
