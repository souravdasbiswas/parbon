import { useState } from 'react';
import { Link } from 'react-router';
import Icon from '../../../components/motifs/Icon.jsx';
import Alpana from '../../../components/motifs/Alpana.jsx';
import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import { usePronami } from '../../../components/donate/PronamiDialog.jsx';
import Logo from '../../../components/ui/Logo.jsx';
import Button from '../../../components/ui/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import Ticker from '../../../components/ui/Ticker.jsx';
import { announcementIcon } from '../../../content/announcementIcons.js';
import { announcements as announcementsCopy } from '../../../content/pages.js';
import { useApi } from '../../../hooks/useApi.js';
import { formatDateRange } from '../../../i18n/format.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import { announcementsApi, contentApi } from '../../../services/api.js';
import BiTitle, { useT } from '../BiTitle.jsx';
import EventHub from './EventHub.jsx';
import { UpdateBubbles } from './sections.jsx';
import styles from './V2Home.module.css';

const tickerCopy = announcementsCopy.ticker;

const ABOUT_INTRO = {
  en: 'A Bengali cultural home for adda, seva, songs, stories and festive togetherness in Hyderabad.',
  bn: 'আড্ডা, সেবা, গান, গল্প আর একসাথে উৎসবের আনন্দে গড়া এক আপন বাঙালি পরিসর।',
};

const ABOUT_ACTIONS = [
  { to: '/about', key: 'story', label: { en: 'Our story', bn: 'আমাদের কথা' }, tone: 'primary' },
  { to: '/get-involved#volunteer', key: 'volunteer', label: { en: 'Volunteer', bn: 'স্বেচ্ছাসেবক' }, tone: 'secondary' },
  { to: '/gallery', key: 'gallery', label: { en: 'Gallery', bn: 'গ্যালারি' }, tone: 'link' },
];

const CATEGORY_COPY = {
  megaphone: { en: 'Community update', bn: 'কমিউনিটি খবর' },
  dhak: { en: 'Puja news', bn: 'পুজোর খবর' },
  people: { en: 'Meet-up', bn: 'মিলনমেলা' },
  lamp: { en: 'Support', bn: 'সহায়তা' },
  music: { en: 'Cultural', bn: 'সাংস্কৃতিক' },
  bhog: { en: 'Bhog & food', bn: 'ভোগ ও খাবার' },
  calendar: { en: 'Dates & schedule', bn: 'দিনক্ষণ' },
  book: { en: 'Workshop & literature', bn: 'সাহিত্য ও কর্মশালা' },
  alpana: { en: 'Art & alpana', bn: 'শিল্প ও আলপনা' },
  sindoor: { en: 'Sindoor khela', bn: 'সিঁদুর খেলা' },
  shankha: { en: 'Ritual update', bn: 'আচার-অনুষ্ঠান' },
};

const isInternal = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

function buildTickerItems({ featured, news, t }) {
  const items = [];
  if (featured) {
    const parts = [
      {
        kind: 'event',
        text: t(featured.title),
        sub: featured.startDate ? formatDateRange(featured.startDate, featured.endDate, 'en', { day: 'numeric', month: 'short' }) : t(featured.dateLabel),
        to: `/events/${featured.slug}`,
      },
    ];
    const venue = featured.venue;
    if (venue?.name) {
      const place = [t(venue.name), t(venue.area)?.split(',')[0]].filter(Boolean).join(', ');
      parts.push({ kind: 'text', text: t(tickerCopy.at) });
      parts.push(venue.mapUrl ? { kind: 'place', text: place, href: venue.mapUrl, ariaLabel: `${place} — ${t(tickerCopy.opensMap)}` } : { kind: 'place', text: place });
    }
    items.push({ key: `event-${featured.slug}`, icon: 'dhak', badge: t(tickerCopy.new), parts });
  }
  for (const a of news || []) {
    items.push({ key: a.id, icon: announcementIcon(a), parts: [{ kind: 'title', text: t(a.title), to: `/announcements/${a.slug}` }] });
  }
  return items;
}

function absoluteAnnouncementUrl(slug) {
  if (typeof window === 'undefined') return `/announcements/${slug}`;
  return `${window.location.origin}/announcements/${slug}`;
}

function excerptFor(announcement, locale) {
  const raw = locale === 'bn'
    ? announcement.body?.bn || announcement.body?.en || ''
    : announcement.body?.en || announcement.body?.bn || '';
  return raw.replace(/\s+/g, ' ').trim();
}

function categoryLabel(announcement, locale) {
  const key = announcementIcon(announcement);
  return CATEGORY_COPY[key]?.[locale] || CATEGORY_COPY.megaphone[locale] || CATEGORY_COPY.megaphone.en;
}

function LatestAction({ to, href, onClick, children, className = '', title }) {
  if (to) {
    return (
      <Link to={to} className={className} title={title}>
        {children}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a href={href} className={className} title={title} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function NewsCard({ announcement, featured = false, headingLevel: Heading = 'h3' }) {
  const { locale, t } = useLocale();
  const { date } = useT();
  const { open: openPronami } = usePronami();
  const [copied, setCopied] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (!announcement) return null;

  const detailHref = `/announcements/${announcement.slug}`;
  const primaryTitle = t(announcement.title);
  const secondaryTitle = locale === 'bn' ? announcement.title?.en : announcement.title?.bn;
  const published = announcement.publishedAt || announcement.createdAt;
  const excerpt = excerptFor(announcement, locale);
  const shareUrl = absoluteAnnouncementUrl(announcement.slug);
  const shareText = `${primaryTitle}\n${shareUrl}`;
  const primaryCta = announcement.showDonation
    ? {
        key: 'pronami',
        label: locale === 'bn' ? 'প্রণামী দিন' : 'Offer pronami',
        onClick: openPronami,
        icon: 'lamp',
      }
    : announcement.link?.url
      ? {
          key: 'cta',
          label: announcement.link.label || (locale === 'bn' ? 'আরও জানুন' : 'Learn more'),
          ...(isInternal(announcement.link.url) ? { to: announcement.link.url } : { href: announcement.link.url }),
          icon: isInternal(announcement.link.url) ? 'arrow' : 'share',
        }
      : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(locale === 'bn' ? 'এই লিঙ্ক কপি করুন:' : 'Copy this link:', shareUrl);
    }
  };

  return (
    <article className={`${styles.newsCard} ${featured ? styles.featuredCard : ''}`}>
      <Link to={detailHref} className={`${styles.posterLink} ${imageReady ? styles.posterLoaded : ''}`} aria-label={primaryTitle}>
        <div className={styles.posterFallback} aria-hidden="true">
          <span className={styles.posterHalo} />
          <Alpana className={styles.posterAlpana} strokeWidth={0.85} />
          <Icon name={announcementIcon(announcement)} size={featured ? 42 : 34} className={styles.posterIcon} />
        </div>
        {announcement.image?.src && !imageFailed && (
          <img
            src={announcement.image.src}
            alt={announcement.image.alt || ''}
            width={announcement.image.width || undefined}
            height={announcement.image.height || undefined}
            loading="eager"
            decoding="async"
            fetchPriority={featured ? 'high' : undefined}
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
          />
        )}
        <span className={styles.posterBadge}>{featured ? (locale === 'bn' ? 'বিশেষ' : 'Featured') : categoryLabel(announcement, locale)}</span>
      </Link>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardChip}>
            <Icon name={announcementIcon(announcement)} size={16} />
            {categoryLabel(announcement, locale)}
          </span>
          {published && (
            <time className={styles.cardDate} dateTime={published}>
              {date(published, { day: 'numeric', month: 'short', year: 'numeric' })}
            </time>
          )}
        </div>

        <div className={styles.cardCopy}>
          <Heading className={styles.cardTitle}>
            <Link to={detailHref}>{primaryTitle}</Link>
          </Heading>
          {secondaryTitle && secondaryTitle !== primaryTitle && (
            <p lang={locale === 'bn' ? 'en' : 'bn'} className={styles.cardTitleAlt}>
              {secondaryTitle}
            </p>
          )}
          {excerpt && <p className={styles.cardExcerpt}>{excerpt}</p>}
        </div>

        <div className={styles.cardActions}>
          {primaryCta && (
            <LatestAction
              to={primaryCta.to}
              href={primaryCta.href}
              onClick={primaryCta.onClick}
              className={`${styles.actionButton} ${styles.primaryAction}`}
            >
              <Icon name={primaryCta.icon} size={16} />
              <span>{primaryCta.label}</span>
            </LatestAction>
          )}

          <div className={styles.actionRow}>
            <LatestAction to={detailHref} className={styles.actionButton}>
              <Icon name="arrow" size={16} />
              <span>{locale === 'bn' ? 'পড়ুন' : 'Read'}</span>
            </LatestAction>
            <LatestAction href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} className={styles.actionButton}>
              <Icon name="whatsapp" size={16} />
              <span>WhatsApp</span>
            </LatestAction>
            <LatestAction onClick={copyLink} className={styles.actionButton}>
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              <span aria-live="polite">{copied ? (locale === 'bn' ? 'কপি হয়েছে ✓' : 'Copied ✓') : (locale === 'bn' ? 'লিঙ্ক কপি' : 'Copy link')}</span>
            </LatestAction>
          </div>
        </div>
      </div>
    </article>
  );
}

function AboutTeaser() {
  const { t } = useLocale();
  return (
    <section className={styles.aboutBanner} aria-labelledby="about-teaser-title">
      <PaarBorder className={styles.aboutPaar} />
      <div className={styles.aboutWatermark} aria-hidden="true">
        <Alpana className={styles.aboutWatermarkArt} strokeWidth={0.9} />
      </div>
      <div className={styles.aboutInner}>
        <div className={styles.aboutLogoShell} aria-hidden="true">
          <div className={styles.aboutLogoArch}>
            <Logo width={88} alt="" loading="eager" />
          </div>
        </div>

        <div className={styles.aboutCopy}>
          <p lang="bn" className={styles.aboutBn}>সংস্কৃতির টানে, একসাথে</p>
          <h2 id="about-teaser-title" className={styles.aboutEn}>Culture brings us together</h2>
          <p className={styles.aboutIntro}>{t(ABOUT_INTRO)}</p>
          <div className={styles.aboutActions}>
            {ABOUT_ACTIONS.map((action) => (
              <Link
                key={action.key}
                to={action.to}
                className={`${styles.bannerButton} ${action.tone === 'primary' ? styles.bannerPrimary : action.tone === 'secondary' ? styles.bannerSecondary : styles.bannerLink}`}
              >
                {t(action.label)}
                {action.tone === 'link' && <span aria-hidden="true">→</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LatestUpdates({ request }) {
  const { locale, t } = useLocale();
  const items = request.data || [];

  return (
    <section className={styles.latestUpdates} aria-labelledby="latest-title">
      <div className={styles.sectionHead}>
        <BiTitle id="latest-title" as="h2" size="sm" bn="সর্বশেষ খবর" en="Latest updates" />
        <Link to="/announcements" className={styles.sectionLink}>
          {t(announcementsCopy.home.all)} <span aria-hidden="true">→</span>
        </Link>
      </div>

      {request.loading && !items.length && <div className={styles.cardsState}><LoadingState lines={4} /></div>}
      {request.error && !items.length && <div className={styles.cardsState}><ErrorState error={request.error} onRetry={request.retry} /></div>}
      {!request.loading && !request.error && !items.length && (
        <div className={styles.cardsState}>
          <EmptyState
            title={{ en: 'Fresh updates are on the way', bn: 'নতুন খবর আসছে' }}
            text={{ en: 'Announcements will appear here as soon as they are published.', bn: 'নতুন ঘোষণা প্রকাশিত হলেই এখানে দেখা যাবে।' }}
          >
            <Button to="/announcements">{locale === 'bn' ? 'সব খবর' : 'All updates'}</Button>
          </EmptyState>
        </div>
      )}

      {items.length > 0 && (
        <div className={`${styles.latestGrid} ${items.length === 2 ? styles.latestTwo : '} ${items.length === 1 ? styles.latestOne : '}`}>
          {items.slice(0, 3).map((announcement, index, arr) => (
            <NewsCard
              key={announcement.id}
              announcement={announcement}
              featured={index === 0 && arr.length > 2}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommunityFallback({ events }) {
  const { locale } = useLocale();
  const upcoming = (events || []).filter((e) => e.status !== 'past').slice(0, 3);
  return (
    <main className={styles.communityFallback}>
      <div className="container section">
        <EmptyState
          title={{ bn: 'শীঘ্রই দেখা হবে', en: 'A new event is coming soon' }}
          text={{ en: 'The featured event is being prepared. Explore the community while we get the next celebration ready.', bn: 'পরের অনুষ্ঠান সাজানো হচ্ছে। ততক্ষণে আমাদের কমিউনিটির খবর দেখে নিন।' }}
        >
          <Button to="/events">{locale === 'bn' ? 'সব অনুষ্ঠান' : 'All events'}</Button>
        </EmptyState>
        {upcoming.length > 0 && (
          <div className={styles.simpleUpcoming}>
            {upcoming.map((e) => (
              <Link key={e.slug} to={`/events/${e.slug}`}>
                <Icon name="calendar" size={18} />
                {e.title?.en}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className={styles.afterHubWrap}>
        <div className={`container ${styles.afterHubStack}`}>
          <AboutTeaser />
        </div>
      </div>
    </main>
  );
}

export default function V2Home() {
  const { t } = useLocale();
  const featured = useApi('event:featured:v2', contentApi.featuredEvent);
  const events = useApi('events', () => contentApi.events());
  const news = useApi('announcements:v2-home', () => announcementsApi.list(3));
  const tickerNews = useApi('announcements:ticker', announcementsApi.ticker);
  const event = featured.data?.data;
  const tickerItems = buildTickerItems({ featured: event, news: tickerNews.data, t });

  if (featured.loading) return <div className="container section"><LoadingState lines={6} /></div>;
  if (featured.error) return <div className="container section"><ErrorState error={featured.error} onRetry={featured.retry} /></div>;
  if (!event) return <CommunityFallback events={events.data || []} />;

  return (
    <>
      <div className={styles.homeUpdates}><UpdateBubbles announcements={news.data || []} /></div>
      <div className={`container ${styles.desktopTicker}`}>
        <Ticker items={tickerItems} label={tickerCopy.label} ariaLabel={tickerCopy.aria} allTo="/announcements" allLabel={t(announcementsCopy.home.all)} />
      </div>
      <EventHub
        event={event}
        showUpdates={false}
        afterHub={(
          <div className={styles.afterHubWrap}>
            <div className={`container ${styles.afterHubStack}`}>
              <LatestUpdates request={news} />
              <AboutTeaser />
            </div>
          </div>
        )}
      />
    </>
  );
}

