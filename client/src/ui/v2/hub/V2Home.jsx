import { Link } from 'react-router';
import AnnouncementCard from '../../../components/announcements/AnnouncementCard.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import Ticker from '../../../components/ui/Ticker.jsx';
import { announcementIcon } from '../../../content/announcementIcons.js';
import { announcements as announcementsCopy, home } from '../../../content/pages.js';
import { useApi } from '../../../hooks/useApi.js';
import { formatDateRange } from '../../../i18n/format.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import { announcementsApi, contentApi } from '../../../services/api.js';
import EventHub from './EventHub.jsx';
import { UpdateBubbles } from './sections.jsx';
import styles from './EventHub.module.css';

const tickerCopy = announcementsCopy.ticker;

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

function AboutTeaser() {
  const { t } = useLocale();
  return (
    <section className={`${styles.aboutTeaser} container`} aria-labelledby="about-teaser-title">
      <div>
        <p lang="bn" className={styles.aboutBn}>সংস্কৃতির টানে, একসাথে</p>
        <h2 id="about-teaser-title">Culture brings us together</h2>
        <p>{t(home.hero.intro)}</p>
      </div>
      <div className={styles.aboutActions}>
        <Button to="/about" variant="secondary">Our story</Button>
        <Button to="/get-involved#volunteer">Volunteer</Button>
        <Button to="/gallery" variant="link">Gallery →</Button>
      </div>
    </section>
  );
}

function LatestUpdates({ items }) {
  const { t } = useLocale();
  if (!items?.length) return null;
  return (
    <section className={`${styles.latestUpdates} container`} aria-labelledby="latest-title">
      <div className={styles.rowHeading}>
        <h2 id="latest-title"><span lang="bn">সর্বশেষ খবর</span><em>Latest updates</em></h2>
        <Link to="/announcements">{t(announcementsCopy.home.all)} →</Link>
      </div>
      <div className={styles.latestGrid}>{items.slice(0, 3).map((a) => <AnnouncementCard key={a.id} announcement={a} compact headingLevel="h3" />)}</div>
    </section>
  );
}

function CommunityFallback({ events }) {
  const { locale } = useLocale();
  const upcoming = (events || []).filter((e) => e.status !== 'past').slice(0, 3);
  return (
    <main className={styles.communityFallback}>
      <div className="container section">
        <EmptyState title={{ bn: 'শীঘ্রই দেখা হবে', en: 'A new event is coming soon' }} text={{ en: 'The featured event is being prepared. Explore the community while we get the next celebration ready.', bn: 'পরের অনুষ্ঠান সাজানো হচ্ছে। ততক্ষণে আমাদের কমিউনিটির খবর দেখে নিন।' }}>
          <Button to="/events">{locale === 'bn' ? 'সব অনুষ্ঠান' : 'All events'}</Button>
        </EmptyState>
        {upcoming.length > 0 && <div className={styles.simpleUpcoming}>{upcoming.map((e) => <Link key={e.slug} to={`/events/${e.slug}`}><Icon name="calendar" size={18} />{e.title?.en}</Link>)}</div>}
      </div>
      <AboutTeaser />
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
      <EventHub event={event} showUpdates={false} afterHub={<><LatestUpdates items={news.data || []} /><AboutTeaser /></>} />
    </>
  );
}
