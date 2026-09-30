import { Link } from 'react-router';
import PronamiPanel from '../../components/donate/PronamiPanel.jsx';
import Alpana from '../../components/motifs/Alpana.jsx';
import Icon from '../../components/motifs/Icon.jsx';
import PaarBorder from '../../components/motifs/PaarBorder.jsx';
import Button from '../../components/ui/Button.jsx';
import Seo from '../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatDate, formatNumber } from '../../i18n/format.js';
import { contentApi } from '../../services/api.js';
import BiTitle, { useT } from './BiTitle.jsx';
import { giveCopy } from './copy.js';
import styles from './GivePage.module.css';
import { useSponsor } from './SponsorSheet.jsx';

const SUPPORT_ART = {
  volunteer: '/brand/coupon-marigold.png',
  membership: '/brand/coupon-lotus.png',
  corporate: '/brand/coupon-mango-toran.png',
  pronami: '/brand/coupon-diya.png',
};

function SponsorBand({ event }) {
  const { t, locale } = useT();
  const sponsor = useSponsor();
  const sponsorship = event?.sponsorship;
  if (!sponsorship?.url) return null;
  const meta = [event?.venue?.name ? t(event.venue.name) : '', event?.startDate ? formatDate(event.startDate, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={styles.sponsorBand} aria-labelledby="featured-sponsor-title" onMouseEnter={sponsor.warmSponsor} onFocus={sponsor.warmSponsor}>
      <Alpana className={styles.bandAlpana} strokeWidth={0.9} />
      <div className={styles.bandCopy}>
        <p className={styles.eyebrow}>{t(giveCopy.sponsor.eyebrow)}</p>
        <BiTitle id="featured-sponsor-title" as="h2" size="md" tone="gold" bn={event.title?.bn || giveCopy.sponsor.title.bn} en={event.title?.en || giveCopy.sponsor.title.en} />
        <p>{t(sponsorship.appeal) || t(giveCopy.intro)}</p>
        <div className={styles.bandActions}>
          <button type="button" className={styles.sponsorCta} onClick={() => sponsor.open(event.slug)}>
            <Icon name="lamp" size={19} />
            {t(sponsorship.cta) || t(giveCopy.sponsor.cta)}
          </button>
          {meta && <span className={styles.bandMeta}>{meta}</span>}
        </div>
      </div>
      <div className={styles.bandVisual}>
        {event?.image?.src ? (
          <img src={event.image.src} alt={event.image.alt || ''} loading="lazy" decoding="async" />
        ) : (
          <div className={styles.bandFallback}>
            <img src="/brand/coupon-dhak.png" alt="" loading="lazy" decoding="async" />
            <img src="/brand/coupon-alpana-gold.png" alt="" loading="lazy" decoding="async" />
          </div>
        )}
        <PaarBorder className={styles.bandPaar} />
      </div>
      {sponsorship.highlights?.length > 0 && (
        <ul role="list" className={styles.highlights}>
          {sponsorship.highlights.slice(0, 4).map((item) => (
            <li key={item.name?.en || item.name?.bn}>
              <span>{t(item.name)}</span>
              {item.amount ? <strong>₹{formatNumber(item.amount, locale)}</strong> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SupportCard({ id, icon, art, title, text, children }) {
  const { t } = useT();
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon} aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
        <img className={styles.cardArt} src={art} alt="" loading="lazy" decoding="async" />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardLabel}>{id}</p>
        <h2>{t(title)}</h2>
        <p>{t(text)}</p>
      </div>
      {children}
    </article>
  );
}

export default function GivePage() {
  const { t } = useT();
  const featured = useApi('featured-event', contentApi.featuredEvent);
  const featuredEvent = featured.data?.data || null;

  return (
    <>
      <Seo title="Give" description="Support Parbon Sanskritik Samity through sponsorship, pronami, volunteering, membership and community partnerships." />
      <section className={styles.hero}>
        <div className="container">
          <BiTitle bn={giveCopy.title.bn} en={giveCopy.title.en} />
          <p className={styles.intro}>{t(giveCopy.intro)}</p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="container">
          {featured.loading && <LoadingState lines={3} />}
          {featured.error && <ErrorState error={featured.error} onRetry={featured.retry} />}
          <SponsorBand event={featuredEvent} />

          <div className={styles.grid}>
            <article className={`${styles.card} ${styles.pronami}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardIcon} aria-hidden="true">
                  <Icon name="lamp" size={24} />
                </span>
                <img className={styles.cardArt} src={SUPPORT_ART.pronami} alt="" loading="lazy" decoding="async" />
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardLabel}>{t({ en: 'Quick support', bn: 'দ্রুত সহায়তা' })}</p>
                <h2>{t(giveCopy.pronami)}</h2>
                <p>{t({ en: 'Offer pronami in a minute and support the next celebration with any amount you choose.', bn: 'এক মিনিটে প্রণামী দিন—আপনার ইচ্ছেমতো অঙ্কেই আগামী আয়োজনের পাশে থাকুন।' })}</p>
              </div>
              <div className={styles.pronamiPanelWrap}>
                <PaarBorder className={styles.pronamiPaar} />
                <PronamiPanel showIntro={false} headingLevel="h3" />
              </div>
            </article>

            <SupportCard id={t({ en: 'Volunteer', bn: 'স্বেচ্ছাসেবা' })} icon="people" art={SUPPORT_ART.volunteer} title={giveCopy.volunteer.title} text={giveCopy.volunteer.text}>
              <Button to="/get-involved#volunteer" variant="secondary" arrow>
                {t(giveCopy.volunteer.cta)}
              </Button>
            </SupportCard>

            <SupportCard id={t({ en: 'Membership', bn: 'সদস্যতা' })} icon="lotus" art={SUPPORT_ART.membership} title={giveCopy.membership.title} text={giveCopy.membership.text}>
              <Button to="/contact?type=membership" variant="secondary" arrow>
                {t(giveCopy.membership.cta)}
              </Button>
            </SupportCard>

            <SupportCard id={t({ en: 'Partnership', bn: 'পার্টনারশিপ' })} icon="pinTop" art={SUPPORT_ART.corporate} title={giveCopy.corporate.title} text={giveCopy.corporate.text}>
              <Link to="/get-involved#sponsorship" className={styles.textLink}>
                {t(giveCopy.corporate.cta)} <span aria-hidden="true">→</span>
              </Link>
            </SupportCard>
          </div>
        </div>
      </section>
    </>
  );
}
