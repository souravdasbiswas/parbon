import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Alpana from '../../../components/motifs/Alpana.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States.jsx';
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

function OpenEventList({ events, loading, error, retry, compact = false }) {
  const { locale, t } = useT();
  if (loading) return <LoadingState lines={2} />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!events?.length) return <p className={styles.muted}>{locale === 'bn' ? 'এখন কোনও পাস খোলা নেই।' : 'No pass bookings are open right now.'}</p>;
  return (
    <ul className={`${styles.openList} ${compact ? styles.compactList : ''}`} role="list">
      {events.map((event) => (
        <li key={event.slug}>
          <div>
            <strong>{t(event.title)}</strong>
            <span>{dateText(event.startsAt, locale)}{event.venue?.name ? ` · ${t(event.venue.name)}` : ''}</span>
          </div>
          <Button to={`/register/${event.slug}`} size="sm">
            {locale === 'bn' ? 'নিন' : 'Get'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function WalletCard({ pass, index, onRemove }) {
  const { locale } = useT();
  const eventTitle = titleOf(pass.eventTitle, locale) || passText.slugTitle(pass.eventSlug) || (locale === 'bn' ? 'পার্বণ' : 'Parbon');
  const typeTitle = titleOf(pass.typeTitle, locale) || (locale === 'bn' ? 'পাস' : 'Pass');
  const bnTitle = titleOf(pass.eventTitle, 'bn') || titleOf(pass.typeTitle, 'bn');
  return (
    <article className={`${styles.walletCard} ${styles[`tone${(index % 3) + 1}`]}`} style={{ '--stack': `${Math.min(index, 3) * -4.25}rem` }}>
      <Link to={`/c/${pass.token}`} className={styles.passLink}>
        <div>
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

export default function PassesPage() {
  const { locale, t } = useT();
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
            <EmptyState title={{ bn: 'এই ফোনে এখনও পাস নেই', en: 'No passes on this phone yet' }} text={{ en: 'Book an open event, or open a coupon link once to save it here.', bn: 'খোলা ইভেন্টে বুক করুন, অথবা কুপন লিংক একবার খুললেই এখানে সেভ হবে।' }}>
              <OpenEventList events={open.data || []} loading={open.loading} error={open.error} retry={open.retry} compact />
            </EmptyState>
          )}
        </div>
      </section>

      <section className={`${styles.section} ${styles.bookMore}`} aria-labelledby="book-more-title">
        <div className="container">
          <div className={styles.bookGrid}>
            <div>
              <BiTitle id="book-more-title" as="h2" size="md" bn="আরও বুক করুন" en="Book more" />
              <p className={styles.muted}>{locale === 'bn' ? 'খোলা পাস ও কুপন এখানে দেখা যাবে।' : 'Open pass and coupon registrations appear here.'}</p>
            </div>
            <OpenEventList events={open.data || []} loading={open.loading} error={open.error} retry={open.retry} />
          </div>
        </div>
      </section>

      <section className={styles.privacy} aria-label="Privacy note">
        <div className="container">
          <Icon name="check" size={18} />
          <p>{t({ en: 'Privacy: this wallet only reads links saved in this browser on this phone. Removing a pass here does not cancel the coupon.', bn: 'গোপনীয়তা: এই ওয়ালেট শুধু এই ফোনের ব্রাউজারে থাকা লিংক পড়ে। এখান থেকে সরালে কুপন বাতিল হয় না।' })}</p>
          <Alpana aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
