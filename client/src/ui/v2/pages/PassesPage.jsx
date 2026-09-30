import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Alpana from '../../../components/motifs/Alpana.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { useApi } from '../../../hooks/useApi.js';
import { formatDate } from '../../../i18n/format.js';
import { couponsApi } from '../../../services/api.js';
import BiTitle, { useT } from '../BiTitle.jsx';
import { listPasses, passText, removePass, subscribe } from '../passStore.js';
import styles from './PassesPage.module.css';

function titleOf(value, locale) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.bn || '';
}

function dateText(date, locale) {
  return date ? formatDate(date, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : locale === 'bn' ? 'তারিখ শীঘ্রই' : 'Date to be announced';
}

function artForEvent(event, locale, t) {
  const text = [titleOf(event?.title, locale), t(event?.title), event?.slug, titleOf(event?.venue?.name, locale)].filter(Boolean).join(' ').toLowerCase();
  if (/puja|durga|উৎসব|পুজো/.test(text)) {
    return { image: '/brand/coupon-dhak.png', gradient: 'linear-gradient(135deg, rgb(127 22 17 / 0.96), rgb(74 51 40 / 0.98))' };
  }
  if (/meet|gather|adda|milan|সম্মিল/.test(text)) {
    return { image: '/brand/coupon-diya.png', gradient: 'linear-gradient(135deg, rgb(239 226 196 / 0.98), rgb(255 253 249 / 0.98), rgb(216 191 138 / 0.88))' };
  }
  return { image: '/brand/coupon-alpana-gold.png', gradient: 'linear-gradient(135deg, rgb(46 31 24 / 0.96), rgb(152 69 32 / 0.9))' };
}

function OpenEventCard({ event }) {
  const { locale, t } = useT();
  const art = artForEvent(event, locale, t);
  return (
    <article className={styles.openCard} style={{ '--open-gradient': art.gradient }}>
      <div className={styles.openArt}>
        <div className={styles.openBackdrop} />
        <img src={art.image} alt="" loading="lazy" decoding="async" />
        <PaarBorder className={styles.openPaar} />
      </div>
      <div className={styles.openBody}>
        <strong>{t(event.title)}</strong>
        <span>{dateText(event.startsAt, locale)}</span>
        {event.venue?.name && <small>{t(event.venue.name)}</small>}
        <Button to={`/register/${event.slug}`} size="sm">
          {locale === 'bn' ? 'পাস নিন' : 'Get passes'}
        </Button>
      </div>
    </article>
  );
}

function OpenEventCollection({ events, loading, error, retry }) {
  const { locale } = useT();
  if (loading) return <LoadingState lines={3} />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!events?.length) return <p className={styles.muted}>{locale === 'bn' ? 'এই মুহূর্তে কোনও খোলা বুকিং নেই।' : 'There are no open pass bookings right now.'}</p>;
  return <div className={styles.openGrid}>{events.map((event) => <OpenEventCard key={event.slug} event={event} />)}</div>;
}

function WalletCard({ pass, index, onRemove }) {
  const { locale } = useT();
  const eventTitle = titleOf(pass.eventTitle, locale) || passText.slugTitle(pass.eventSlug) || (locale === 'bn' ? 'পার্বণ' : 'Parbon');
  const typeTitle = titleOf(pass.typeTitle, locale) || (locale === 'bn' ? 'পাস' : 'Pass');
  const bnTitle = titleOf(pass.eventTitle, 'bn') || titleOf(pass.typeTitle, 'bn');
  return (
    <article className={`${styles.walletCard} ${styles[`tone${(index % 3) + 1}`]}`} style={{ '--stack': `${Math.min(index, 3) * -4.25}rem` }}>
      <Link to={`/c/${pass.token}`} className={styles.passLink}>
        <div className={styles.passMeta}>
          {bnTitle && <span lang="bn" className={styles.bnTitle}>{bnTitle}</span>}
          <small>{eventTitle}</small>
          <p className={styles.big}>{typeTitle}</p>
          <p>{dateText(pass.date, locale)}</p>
        </div>
        <span className={styles.qr} aria-hidden="true" />
      </Link>
      <button type="button" className={styles.remove} onClick={() => onRemove(pass)}>
        {locale === 'bn' ? 'এই ফোন থেকে সরান' : 'Remove from this phone'}
      </button>
    </article>
  );
}

function EmptyWallet({ open }) {
  const { locale } = useT();
  return (
    <section className={styles.emptyWallet} aria-labelledby="empty-wallet-title">
      <div className={styles.emptyIntro}>
        <div className={styles.ticketScene} aria-hidden="true">
          <div className={styles.ticketCard}>
            <img src="/brand/coupon-dhak.png" alt="" loading="lazy" decoding="async" />
            <div>
              <strong>{locale === 'bn' ? 'পার্বণ' : 'Parbon'}</strong>
              <span>{locale === 'bn' ? 'আপনার পরের উৎসবের টিকিট' : 'Your next celebration ticket'}</span>
            </div>
            <PaarBorder className={styles.ticketPaar} />
          </div>
        </div>
        <div>
          <h2 id="empty-wallet-title">{locale === 'bn' ? 'এই ফোনে এখনও পাস নেই' : 'No passes on this phone yet'}</h2>
          <p>{locale === 'bn' ? 'যে কোনও খোলা ইভেন্টে এখনই নাম লিখিয়ে পাস সেভ করে রাখুন। কুপন লিংক একবার খুললেই সেটি এই ওয়ালেটে দেখা যাবে।' : 'Book an open event now and keep the pass saved here. Opening a coupon link once is enough to add it to this wallet.'}</p>
        </div>
      </div>
      <div className={styles.emptyListBlock}>
        <div className={styles.emptyHeading}>
          <BiTitle as="h3" size="sm" bn="এখনই পাস নিন" en="Get passes" />
          <p className={styles.muted}>{locale === 'bn' ? 'যে ইভেন্টগুলো খোলা আছে' : 'Events open for booking right now'}</p>
        </div>
        <OpenEventCollection events={open.data || []} loading={open.loading} error={open.error} retry={open.retry} />
      </div>
    </section>
  );
}

export default function PassesPage() {
  const { locale } = useT();
  const [passes, setPasses] = useState(() => listPasses());
  const open = useApi('coupon-events:open:v2-passes', () => couponsApi.openEvents());

  useEffect(() => subscribe(setPasses), []);

  const onRemove = (pass) => {
    const label = titleOf(pass.typeTitle, locale) || pass.token;
    if (!window.confirm(locale === 'bn' ? `${label} এই ফোন থেকে সরাবেন?` : `Remove ${label} from this phone?`)) return;
    setPasses(removePass(pass.token));
  };

  return (
    <>
      <Seo title="My passes" description="Passes saved on this phone for Parbon events." noindex />
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>{locale === 'bn' ? 'এই ফোনে সেভ করা' : 'Saved on this phone'}</p>
          <BiTitle bn="আমার পাস" en="My passes" />
          <p className={styles.intro}>{locale === 'bn' ? 'গেটে QR কোড দেখাতে পাস খুলুন।' : 'Open a pass and show its QR code at the gate.'}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="wallet-title">
        <div className="container">
          <div className={styles.walletHeader}>
            <BiTitle id="wallet-title" as="h2" size="md" bn="ওয়ালেট" en="Wallet" />
            <p>{locale === 'bn' ? 'শুধু এই ডিভাইসে সেভ থাকে।' : 'Stored only on this device.'}</p>
          </div>

          {passes.length > 0 ? (
            <div className={styles.wallet}>
              {passes.map((pass, index) => <WalletCard key={pass.token} pass={pass} index={index} onRemove={onRemove} />)}
            </div>
          ) : (
            <EmptyWallet open={open} />
          )}
        </div>
      </section>

      {passes.length > 0 && (
        <section className={`${styles.section} ${styles.bookMore}`} aria-labelledby="book-more-title">
          <div className="container">
            <div className={styles.bookGrid}>
              <div>
                <BiTitle id="book-more-title" as="h2" size="md" bn="আরও বুক করুন" en="Book more" />
                <p className={styles.muted}>{locale === 'bn' ? 'খোলা পাস ও কুপন এখানে দেখা যাবে।' : 'Open pass and coupon registrations appear here.'}</p>
              </div>
              <OpenEventCollection events={open.data || []} loading={open.loading} error={open.error} retry={open.retry} />
            </div>
          </div>
        </section>
      )}

      <section className={styles.privacy} aria-label="Privacy note">
        <div className="container">
          <Icon name="check" size={18} />
          <p>{locale === 'bn' ? 'গোপনীয়তা: এই ওয়ালেট শুধু এই ফোনের ব্রাউজারে থাকা লিংক পড়ে। এখান থেকে সরালে কুপন বাতিল হয় না।' : 'Privacy: this wallet only reads links saved in this browser on this phone. Removing a pass here does not cancel the coupon.'}</p>
          <Alpana aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
