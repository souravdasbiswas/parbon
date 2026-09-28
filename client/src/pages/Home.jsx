import { Link } from 'react-router';
import AnnouncementCard from '../components/announcements/AnnouncementCard.jsx';
import { usePronami } from '../components/donate/PronamiDialog.jsx';
import PronamiPanel from '../components/donate/PronamiPanel.jsx';
import ArchOutline from '../components/motifs/ArchOutline.jsx';
import Icon from '../components/motifs/Icon.jsx';
import Alpana from '../components/motifs/Alpana.jsx';
import LotusDivider from '../components/motifs/LotusDivider.jsx';
import PaarBorder from '../components/motifs/PaarBorder.jsx';
import Button from '../components/ui/Button.jsx';
import Countdown from '../components/ui/Countdown.jsx';
import EventCard from '../components/ui/EventCard.jsx';
import FeatureCard, { FeatureGrid } from '../components/ui/FeatureCard.jsx';
import Logo from '../components/ui/Logo.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import Ticker from '../components/ui/Ticker.jsx';
import { announcementIcon } from '../content/announcementIcons.js';
import { announcements as announcementsCopy, home } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { formatDate, formatDateRange, toBengaliDigits } from '../i18n/format.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { announcementsApi, contentApi } from '../services/api.js';
import styles from './Home.module.css';

const tickerCopy = announcementsCopy.ticker;

/** Fixed Puja item first (dates → Puja page, venue → Google Maps), then the latest announcements. */
function buildTickerItems({ puja, news, t }) {
  const items = [];
  if (puja) {
    const parts = [
      {
        kind: 'event',
        text: t(puja.title),
        sub: formatDateRange(puja.startDate, puja.endDate, 'en', { day: 'numeric', month: 'short' }),
        to: '/durga-puja',
      },
    ];
    const venue = puja.venue;
    if (venue?.name) {
      const place = [t(venue.name), t(venue.area)?.split(',')[0]].filter(Boolean).join(', ');
      parts.push({ kind: 'text', text: t(tickerCopy.at) });
      parts.push(
        venue.mapUrl
          ? { kind: 'place', text: place, href: venue.mapUrl, ariaLabel: `${place} — ${t(tickerCopy.opensMap)}` }
          : { kind: 'place', text: place },
      );
    }
    items.push({ key: `event-${puja.slug}`, icon: 'dhak', badge: t(tickerCopy.new), parts });
  }
  for (const a of news || []) {
    items.push({ key: a.id, icon: announcementIcon(a), parts: [{ kind: 'title', text: t(a.title), to: `/announcements/${a.slug}` }] });
  }
  return items;
}

export default function Home() {
  const { t } = useLocale();
  const { open: openPronami } = usePronami();
  const site = useApi('site', contentApi.site);
  const events = useApi('events', () => contentApi.events());
  const puja = useApi('event:durga-puja-2026', () => contentApi.event('durga-puja-2026'));
  const news = useApi('announcements:home', () => announcementsApi.list(2));
  const tickerNews = useApi('announcements:ticker', announcementsApi.ticker);

  const featured = site.data?.featuredEvent;
  const upcoming = (events.data || []).slice(0, 3);
  const pujaDays = (puja.data?.schedule || []).filter((d) => d.main);
  const tickerItems = buildTickerItems({ puja: puja.data, news: tickerNews.data, t });
  const latestCards = news.data || [];

  return (
    <>
      <Seo description="Parbon Sanskritik Samity — a Bengali cultural community celebrating music, literature, art, food and festivals. Join us for our first Durga Puja, 16–21 October 2026." />

      {/* ───────── Hero ───────── */}
      <section className={styles.hero} aria-labelledby="page-title">
        <Alpana className={styles.heroAlpana} strokeWidth={0.8} />
        <div className={`container ${styles.heroGrid}`}>
          {/* Reserved slot so the ticker (loaded from the API) never shifts the hero. First on every screen. */}
          <div className={styles.noticeSlot}>
            <Ticker
              items={tickerItems}
              label={tickerCopy.label}
              ariaLabel={tickerCopy.aria}
              allTo="/announcements"
              allLabel={t(announcementsCopy.home.all)}
            />
          </div>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>
              <span lang="bn">{home.hero.eyebrow.bn}</span>
              <span aria-hidden="true">·</span>
              <span>{home.hero.eyebrow.en}</span>
            </p>
            <h1 id="page-title" className={styles.heroTitle}>
              <span lang="bn" className={styles.heroTitleBn}>
                {home.hero.title.bn}
              </span>
              <span className={styles.heroTitleEn}>{home.hero.title.en}</span>
            </h1>
            <p className={styles.heroIntro}>{t(home.hero.intro)}</p>
            <div className={styles.heroActions}>
              <Button to="/durga-puja" size="lg" arrow>
                {t(home.hero.primaryCta)}
              </Button>
              <Button to="/get-involved" variant="secondary" size="lg">
                {t(home.hero.secondaryCta)}
              </Button>
            </div>
          </div>

          <div className={styles.heroArt}>
            <div className={styles.arch}>
              <ArchOutline className={styles.archOutline} fill="var(--color-paper)" />
              <Logo
                width={400}
                sizes="(min-width: 960px) 400px, 70vw"
                loading="eager"
                fetchPriority="high"
                className={styles.heroLogo}
                alt="Parbon Sanskritik Samity logo — a temple gateway flanked by two dhakis playing the dhak"
              />
            </div>
          </div>
        </div>

        <div className={`container ${styles.countdownWrap}`}>
          {featured && (
            <div className={styles.countdownCard}>
              <Countdown target={featured.countdownTo} label={featured.label} />
              <div className={styles.countdownActions}>
                <Link to={`/events/${featured.slug}`} className={styles.countdownLink}>
                  <span lang="bn">পুজোর নির্ঘণ্ট</span>
                  <span>View Puja schedule →</span>
                </Link>
                <button type="button" className={styles.pronamiPill} onClick={openPronami}>
                  <Icon name="lamp" size={18} />
                  <span lang="bn">প্রণামী</span>
                  <span className={styles.pronamiPillEn}>Offer pronami</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ───────── Story ───────── */}
      <section className={`section ${styles.story}`} aria-labelledby="story-title">
        <div className={`container ${styles.storyGrid}`}>
          <SectionHeading id="story-title" eyebrow={home.story.eyebrow} title={home.story.title} align="start" />
          <div className={`${styles.storyBody} reveal`}>
            {home.story.body.map((p, i) => (
              <div key={i} className={styles.storyPara}>
                <p className={styles.storyEn}>{t(p)}</p>
                <p lang="bn" className={styles.storyBn}>
                  {p.bn}
                </p>
              </div>
            ))}
            <Button to="/about" variant="link" arrow>
              {t(home.story.cta)}
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── Durga Puja feature ───────── */}
      <section className={styles.puja} aria-labelledby="puja-title">
        <Alpana className={styles.pujaAlpana} strokeWidth={0.7} />
        <div className="container">
          <SectionHeading id="puja-title" eyebrow={home.puja.eyebrow} title={home.puja.title} tone="dark" divider />
          <p className={styles.pujaIntro}>{t(home.puja.body)}</p>
          <p lang="bn" className={styles.pujaIntroBn}>
            {home.puja.body.bn}
          </p>

          {puja.loading && <LoadingState lines={2} />}
          {pujaDays.length > 0 && (
            <ol className={styles.days} role="list">
              {pujaDays.map((d) => (
                <li key={d.date} className={`${styles.day} reveal`}>
                  <span lang="bn" className={styles.dayBn}>
                    {d.day.bn}
                  </span>
                  <span className={styles.dayEn}>{d.day.en}</span>
                  <span className={styles.dayDate}>
                    <time dateTime={d.date}>{formatDate(d.date, 'en', { weekday: 'short', day: 'numeric', month: 'short' })}</time>
                  </span>
                  <span lang="bn" className={styles.dayDateBn}>
                    {toBengaliDigits(formatDate(d.date, 'bn', { day: 'numeric', month: 'long' }))}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className={styles.pujaActions}>
            {puja.data?.venue?.name && (
              <p className={styles.pujaVenue}>
                <Icon name="pin" size={18} />
                <span>
                  <span lang="bn" className={styles.pujaVenueBn}>
                    {puja.data.venue.spot?.bn}
                  </span>{' '}
                  {t(puja.data.venue.name)}, {t(puja.data.venue.area)}
                </span>
                {puja.data.venue.mapUrl && (
                  <a href={puja.data.venue.mapUrl} target="_blank" rel="noopener noreferrer">
                    Directions ↗
                  </a>
                )}
              </p>
            )}
            <Button to="/durga-puja" variant="gold" size="lg" arrow>
              {t(home.puja.cta)}
            </Button>
          </div>

          {/* Pronami — the offering to Ma, woven into the Puja story rather than a separate "donate" banner. */}
          <div className={`${styles.pronami} reveal`} id="pronami">
            <PronamiPanel tone="dark" />
          </div>
        </div>
      </section>

      {/* ───────── Announcements ───────── */}
      {latestCards.length > 0 && (
        <section className={`section ${styles.news}`} aria-labelledby="news-title">
          <div className="container">
            <SectionHeading id="news-title" eyebrow={announcementsCopy.home.eyebrow} title={announcementsCopy.home.title} />
            <div className={`${styles.newsGrid} ${latestCards.length === 1 ? styles.newsSingle : ''}`}>
              {latestCards.map((a) => (
                <div key={a.id} className="reveal">
                  <AnnouncementCard announcement={a} compact />
                </div>
              ))}
            </div>
            <div className={styles.center}>
              <Button to="/announcements" variant="secondary" arrow>
                {t(announcementsCopy.home.cta)}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ───────── Pillars ───────── */}
      <section className="section" aria-labelledby="pillars-title">
        <div className="container">
          <SectionHeading id="pillars-title" eyebrow={home.pillars.eyebrow} title={home.pillars.title} />
          <FeatureGrid min="300px">
            {home.pillars.items.map((item) => (
              <FeatureCard key={item.icon} icon={item.icon} title={item.title} text={item.text} />
            ))}
          </FeatureGrid>
        </div>
      </section>

      {/* ───────── Quote ───────── */}
      <section className={styles.quote} aria-label="Invocation from the Chandi">
        <PaarBorder />
        <figure className={`container-narrow ${styles.quoteInner} reveal`}>
          <blockquote>
            <p lang="bn" className={styles.quoteBn}>
              {home.quote.text.bn}
            </p>
            <p className={styles.quoteEn}>{home.quote.text.en}</p>
          </blockquote>
          <figcaption className={styles.quoteSource}>
            — <span lang="bn">{home.quote.source.bn}</span> · {home.quote.source.en}
          </figcaption>
        </figure>
      </section>

      {/* ───────── Events ───────── */}
      <section className="section section--tint" aria-labelledby="events-title">
        <div className="container">
          <SectionHeading id="events-title" eyebrow={home.events.eyebrow} title={home.events.title} />
          {events.loading && <LoadingState lines={3} />}
          {events.error && <ErrorState error={events.error} onRetry={events.retry} />}
          {upcoming.length > 0 && (
            <div className={styles.eventGrid}>
              {upcoming.map((event, i) => (
                <EventCard key={event.slug} event={event} featured={i === 0 && event.featured} />
              ))}
            </div>
          )}
          <div className={styles.center}>
            <Button to="/events" variant="secondary" arrow>
              {t(home.events.cta)}
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── Call to action ───────── */}
      <section className={`section ${styles.cta}`} aria-labelledby="cta-title">
        <div className={`container-narrow ${styles.ctaInner} reveal`}>
          <LotusDivider className={styles.ctaDivider} />
          <h2 id="cta-title" className={styles.ctaTitle}>
            <span lang="bn">{home.cta.title.bn}</span>
            <span className={styles.ctaTitleEn}>{home.cta.title.en}</span>
          </h2>
          <p className={styles.ctaBody}>{t(home.cta.body)}</p>
          <div className={styles.ctaActions}>
            <Button to="/get-involved#volunteer" arrow>
              {t(home.cta.volunteer)}
            </Button>
            <Button to="/get-involved#sponsorship" variant="secondary">
              {t(home.cta.support)}
            </Button>
            <Button to="/contact" variant="link" arrow>
              {t(home.cta.contact)}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
