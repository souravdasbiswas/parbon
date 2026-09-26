import { useState } from 'react';
import { Link } from 'react-router';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { usePronami } from '../donate/PronamiDialog.jsx';
import Icon from '../motifs/Icon.jsx';
import RichText from '../ui/RichText.jsx';
import styles from './AnnouncementCard.module.css';

const dateLabel = (iso) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const timeLabel = (iso) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const digits = (n) => String(n || '').replace(/\D/g, '');
const isInternal = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

function ShareActions({ announcement }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/announcements/${announcement.slug}`;
  const shareText = `${announcement.title.en}\n${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };
  const nativeShare = () => navigator.share?.({ title: announcement.title.en, url }).catch(() => {});

  return (
    <div className={styles.share}>
      <a className={styles.shareBtn} href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
        <Icon name="whatsapp" size={17} /> Share on WhatsApp
      </a>
      <button type="button" className={styles.shareBtn} onClick={copy}>
        <Icon name={copied ? 'check' : 'link'} size={17} /> <span aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</span>
      </button>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" className={styles.shareBtn} onClick={nativeShare}>
          <Icon name="share" size={17} /> Share
        </button>
      )}
    </div>
  );
}

/**
 * An announcement presented like a message in a WhatsApp community — but in the
 * Parbon palette. `compact` trims long text and tall images for listings.
 */
export default function AnnouncementCard({ announcement: a, compact = false, headingLevel: H = 'h3', preview = false }) {
  const { t } = useLocale();
  const { open: openPronami } = usePronami();
  if (!a) return null;
  const detailHref = `/announcements/${a.slug}`;
  const published = a.publishedAt || new Date().toISOString();
  const body = t(a.body) || a.body?.bn;
  const loc = a.location;
  const contact = a.contact;

  const image = a.image?.src && (
    <img
      src={a.image.src}
      alt={a.image.alt || ''}
      width={a.image.width || undefined}
      height={a.image.height || undefined}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <header className={styles.chatHeader}>
        <span className={styles.avatar} aria-hidden="true">
          <img src="/brand/logo-160.png" alt="" width="40" height="54" />
        </span>
        <span className={styles.who}>
          <span className={styles.name}>
            Parbon Sanskritik Samity
            <span className={styles.verified} title="Official announcement">
              <Icon name="check" size={11} strokeWidth={3} />
            </span>
          </span>
          <span className={styles.sub}>
            Announcement · <span lang="bn">ঘোষণা</span>
          </span>
        </span>
        {a.pinned && (
          <span className={styles.pinned} title="Pinned">
            <Icon name="pinTop" size={18} />
            <span className="visually-hidden">Pinned</span>
          </span>
        )}
      </header>

      <div className={styles.chat}>
        <p className={styles.dateChip}>
          <time dateTime={published}>{dateLabel(published)}</time>
        </p>

        <div className={styles.bubble}>
          {image &&
            (compact && !preview ? (
              <Link to={detailHref} className={styles.media} tabIndex={-1} aria-hidden="true">
                {image}
              </Link>
            ) : (
              <a href={a.image.src} target="_blank" rel="noopener noreferrer" className={styles.media}>
                {image}
                <span className="visually-hidden">(open full-size image)</span>
              </a>
            ))}

          <div className={styles.content}>
            <H className={styles.title}>
              {compact && !preview ? (
                <Link to={detailHref} className={styles.titleLink}>
                  {t(a.title)}
                </Link>
              ) : (
                t(a.title)
              )}
              {a.title?.bn && a.title.bn !== t(a.title) && (
                <span lang="bn" className={styles.titleBn}>
                  {a.title.bn}
                </span>
              )}
            </H>

            <RichText text={body} className={styles.text} linkClassName={styles.inlineLink} />
            {a.body?.bn && a.body.bn !== body && <RichText text={a.body.bn} className={`${styles.text} ${styles.textBn}`} />}

            {loc && (loc.name || loc.address) && (
              <div className={styles.attachment}>
                <Icon name="pin" size={18} />
                <div>
                  {loc.name && <p className={styles.attTitle}>{loc.name}</p>}
                  {loc.address && <p className={styles.attText}>{loc.address}</p>}
                  {loc.mapUrl && (
                    <a href={loc.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.attLink}>
                      Open in Google Maps ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {contact && (contact.name || contact.phone || contact.whatsapp || contact.email) && (
              <div className={styles.attachment}>
                <Icon name="phone" size={18} />
                <div>
                  <p className={styles.attTitle}>{contact.name || 'Contact'}</p>
                  <p className={styles.attLinks}>
                    {contact.phone && <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>}
                    {contact.whatsapp && (
                      <a href={`https://wa.me/${digits(contact.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                  </p>
                </div>
              </div>
            )}

            <p className={styles.meta}>
              <time dateTime={published}>{timeLabel(published)}</time>
              <span className={styles.ticks} aria-hidden="true">
                <Icon name="check" size={13} strokeWidth={2.4} />
                <Icon name="check" size={13} strokeWidth={2.4} />
              </span>
            </p>
          </div>
        </div>

        {(a.showDonation || a.link?.url || compact) && (
          <div className={styles.replies}>
            {a.showDonation && (
              <button type="button" className={`${styles.reply} ${styles.replyPrimary}`} onClick={openPronami}>
                <span lang="bn">প্রণামী দিন</span> · Offer pronami
              </button>
            )}
            {a.link?.url &&
              (isInternal(a.link.url) ? (
                <Link to={a.link.url} className={styles.reply}>
                  {a.link.label || 'Learn more'} →
                </Link>
              ) : (
                <a href={a.link.url} target="_blank" rel="noopener noreferrer" className={styles.reply}>
                  {a.link.label || 'Learn more'} ↗
                </a>
              ))}
            {compact && !preview && (
              <Link to={detailHref} className={styles.reply}>
                Read announcement →
              </Link>
            )}
          </div>
        )}
      </div>

      {!preview && <ShareActions announcement={a} />}
    </article>
  );
}
