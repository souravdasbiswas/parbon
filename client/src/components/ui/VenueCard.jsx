import { useLocale } from '../../i18n/LocaleContext.jsx';
import Icon from '../motifs/Icon.jsx';
import Button from './Button.jsx';
import styles from './VenueCard.module.css';

/**
 * Event venue: bilingual name, where in the building (e.g. "On the terrace"),
 * address, a directions link and an optional embedded map.
 */
export default function VenueCard({ venue, showMap = true, compact = false, headingLevel: H = 'h3' }) {
  const { t } = useLocale();
  if (!venue?.name) return null;
  const withMap = showMap && venue.mapEmbedUrl && !compact;

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''} ${withMap ? styles.withMap : ''}`}>
      <div className={styles.details}>
        {venue.spot && (
          <p className={styles.spot}>
            <Icon name="pin" size={16} />
            <span>{t(venue.spot)}</span>
            {venue.spot.bn && <span lang="bn">· {venue.spot.bn}</span>}
          </p>
        )}
        <H className={styles.name}>
          <span className={styles.nameEn}>{t(venue.name)}</span>
          {venue.name.bn && (
            <span lang="bn" className={styles.nameBn}>
              {venue.name.bn}
            </span>
          )}
        </H>
        {venue.address && (
          <address className={styles.address}>
            <span>{t(venue.address)}</span>
            {!compact && venue.address.bn && <span lang="bn">{venue.address.bn}</span>}
          </address>
        )}
        {venue.mapUrl && (
          <div className={styles.actions}>
            <Button href={venue.mapUrl} size={compact ? 'sm' : 'md'} arrow aria-label={`Get directions to ${t(venue.name)} (opens Google Maps)`}>
              Get directions
            </Button>
          </div>
        )}
      </div>
      {withMap && (
        <div className={styles.map}>
          <iframe
            src={venue.mapEmbedUrl}
            title={`Map showing ${t(venue.name)}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
    </article>
  );
}
