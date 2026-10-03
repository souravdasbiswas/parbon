import { Link } from 'react-router';
import { formatDate, formatDateRange, formatTimeRange, parseDate, toBengaliDigits } from '../../i18n/format.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import Icon from '../motifs/Icon.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import styles from './EventCard.module.css';

function DateBadge({ start, end }) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s) {
    return (
      <div className={`${styles.badge} ${styles.badgeTba}`} aria-hidden="true">
        <span lang="bn" className={styles.badgeBn}>
          শীঘ্রই
        </span>
        <span className={styles.badgeMonth}>Soon</span>
      </div>
    );
  }
  const days = e && e.getTime() !== s.getTime() ? `${s.getDate()}–${e.getDate()}` : `${s.getDate()}`;
  return (
    <div className={styles.badge} aria-hidden="true">
      <span className={styles.badgeDay}>{days}</span>
      <span className={styles.badgeMonth}>{formatDate(start, 'en', { month: 'short', year: 'numeric' })}</span>
      <span lang="bn" className={styles.badgeBn}>
        {toBengaliDigits(days)} {formatDate(start, 'bn', { month: 'long' })}
      </span>
    </div>
  );
}

export default function EventCard({ event, featured = false, headingLevel: H = 'h3' }) {
  const { t } = useLocale();
  const when = event.startDate ? formatDateRange(event.startDate, event.endDate, 'en') : t(event.dateLabel);
  const time = event.startDate ? formatTimeRange(event.startTime, event.endTime) : '';
  const video = event.video?.src ? event.video : null;
  // With a video, the picture and the video sit together below the text instead of the small cover.
  const cover = event.image?.src && !video;

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''} ${cover ? styles.withImage : ''} reveal`}>
      <DateBadge start={event.startDate} end={event.endDate} />
      <div className={styles.body}>
        {event.category && <p className={styles.category}>{t(event.category)}</p>}
        <H className={styles.title}>
          <Link to={`/events/${event.slug}`} className={styles.link}>
            <span lang="bn" className={styles.titleBn}>
              {event.title.bn}
            </span>
            <span className={styles.titleEn}>{event.title.en}</span>
          </Link>
        </H>
        <p className={styles.meta}>
          <Icon name="calendar" size={16} />
          <span>
            {when}
            {time && <> · {time}</>}
          </span>
        </p>
        {event.venue?.name && (
          <p className={styles.meta}>
            <Icon name="pin" size={16} />
            <span>
              {t(event.venue.name)}
              {event.venue.spot && <> · {t(event.venue.spot)}</>}
              {event.venue.area && <>, {t(event.venue.area)}</>}
            </span>
          </p>
        )}
        <p className={styles.summary}>{t(event.summary)}</p>
        {featured && event.summary?.bn && (
          <p lang="bn" className={styles.summaryBn}>
            {event.summary.bn}
          </p>
        )}
        <span className={styles.more} aria-hidden="true">
          Details <Icon name="arrow" size={16} />
        </span>
      </div>
      {cover && <img className={styles.cover} src={event.image.src} alt="" loading="lazy" decoding="async" width={event.image.width || undefined} height={event.image.height || undefined} />}
      {video && (
        <div className={`${styles.media} ${event.image?.src ? '' : styles.mediaSolo}`}>
          {event.image?.src && (
            <img className={styles.mediaPhoto} src={event.image.src} alt={event.image.alt || ''} loading="lazy" decoding="async" width={event.image.width || undefined} height={event.image.height || undefined} />
          )}
          <VideoPlayer
            src={video.src}
            poster={video.poster}
            width={video.width}
            height={video.height}
            duration={video.duration}
            label={`${event.title.en} — ${t(video.title) || 'video'}`}
            className={styles.mediaVideo}
          />
        </div>
      )}
    </article>
  );
}
