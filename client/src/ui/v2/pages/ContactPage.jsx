import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import InquiryForm from '../../../components/forms/InquiryForm.jsx';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { contact as contactCopy } from '../../../content/pages.js';
import { useApi } from '../../../hooks/useApi.js';
import { contentApi } from '../../../services/api.js';
import BiTitle, { useT } from '../BiTitle.jsx';
import styles from './ContactPage.module.css';

const cleanPhone = (value) => String(value || '').replace(/[^\d+]/g, '');
const waHref = (value) => (value ? `https://wa.me/${String(value).replace(/\D/g, '')}` : '');

function initials(name) {
  const text = String(name || '').trim();
  const parts = text.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : text.slice(0, 2)).toUpperCase();
}

function unique(items) {
  return items.filter((item, index) => item && items.indexOf(item) === index);
}

function PersonRow({ person }) {
  const { locale, t } = useT();
  const name = t(person.name) || person.name || '';
  const role = t(person.role) || '';
  const phone = cleanPhone(person.phone);
  const whatsapp = person.whatsapp ? waHref(person.whatsapp) : phone ? waHref(phone) : '';
  return (
    <li className={styles.person}>
      {person.photo ? <img className={styles.avatar} src={person.photo} alt="" loading="lazy" /> : <span className={styles.avatar}>{initials(name)}</span>}
      <div className={styles.personText}>
        <strong>{name}</strong>
        {role && <span>{role}</span>}
      </div>
      {phone && (
        <a className={styles.roundAction} href={`tel:${phone}`} aria-label={`${locale === 'bn' ? 'ফোন করুন' : 'Call'} ${name}`}>
          <Icon name="phone" size={18} />
        </a>
      )}
      {whatsapp && (
        <a className={`${styles.roundAction} ${styles.whatsapp}`} href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`}>
          <Icon name="whatsapp" size={18} />
        </a>
      )}
    </li>
  );
}

function DirectRows({ rows }) {
  if (!rows.length) return null;
  return (
    <ul className={styles.directRows} role="list">
      {rows.map((row) => (
        <li key={`${row.icon}-${row.label}`}>
          <Icon name={row.icon} size={20} />
          {row.href ? <a href={row.href} {...(row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{row.label}</a> : <span>{row.label}</span>}
          {row.note && <small>{row.note}</small>}
        </li>
      ))}
    </ul>
  );
}

function GeneralContactCard({ contact, people, socials }) {
  const { locale, t } = useT();
  const phone = cleanPhone(contact?.phone);
  const whatsapp = contact?.whatsapp ? waHref(contact.whatsapp) : phone ? waHref(phone) : '';
  const rows = [
    contact?.email && { icon: 'mail', label: contact.email, href: `mailto:${contact.email}`, note: t(contact?.responseTime) || (locale === 'bn' ? 'সাধারণত দুই কর্মদিবসের মধ্যে উত্তর দিই।' : 'We usually reply within two working days.') },
    phone && { icon: 'phone', label: contact.phone, href: `tel:${phone}` },
    whatsapp && { icon: 'whatsapp', label: locale === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp', href: whatsapp, external: true },
  ].filter(Boolean);
  const hasPeople = people.length > 0;

  return (
    <section className={styles.card} aria-labelledby="committee-title">
      <BiTitle
        id="committee-title"
        as="h2"
        size="sm"
        bn={hasPeople ? 'সমিতির সঙ্গে কথা বলুন' : 'সমিতির সঙ্গে যোগাযোগ'}
        en={hasPeople ? 'Committee contacts' : 'Reach the samity'}
      />
      {!hasPeople && (
        <p className={styles.contactIntro}>
          {locale === 'bn'
            ? 'কমিটির ব্যক্তিগত তালিকা পরে যোগ হবে। ততক্ষণে এই সাধারণ যোগাযোগ মাধ্যমগুলোতেই বার্তা পাঠান—আমরা সাড়া দেব।'
            : 'The individual committee list will be added soon. Until then, message us through these general channels and we will respond.'}
        </p>
      )}
      {hasPeople && (
        <ul className={styles.people} role="list">
          {people.map((person) => <PersonRow key={person.id || t(person.name)} person={person} />)}
        </ul>
      )}
      <div className={styles.subsection}>
        <p className={styles.sectionLabel}>{locale === 'bn' ? 'সাধারণ যোগাযোগ' : 'General contact'}</p>
        <DirectRows rows={rows} />
      </div>
      {(contact?.whatsappCommunity || socials.length > 0) && (
        <div className={styles.cardFooter}>
          {contact?.whatsappCommunity && (
            <a className={styles.inlineCta} href={contact.whatsappCommunity} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" size={18} /> {locale === 'bn' ? 'কমিউনিটিতে যোগ দিন' : 'Join the community'}
            </a>
          )}
          {socials.map((social) => (
            <a key={social.platform} className={styles.socialChip} href={social.url} target="_blank" rel="noopener noreferrer">
              <Icon name={social.platform} size={18} /> {social.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function VenueMap({ mapEmbedUrl, title, loading }) {
  const { locale } = useT();
  const [status, setStatus] = useState(() => (mapEmbedUrl ? 'loading' : 'idle'));

  const pending = loading || (mapEmbedUrl && status === 'loading');
  const failed = !loading && (!mapEmbedUrl || status === 'failed');

  return (
    <div className={styles.mapSurface}>
      <div className={styles.staticMap} aria-hidden="true">
        <span />
      </div>
      {mapEmbedUrl && (
        <iframe
          className={`${styles.mapFrame} ${status === 'ready' ? styles.mapVisible : ''}`}
          src={mapEmbedUrl}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('failed')}
        />
      )}
      {pending && (
        <div className={styles.mapOverlay} aria-hidden="true">
          <LoadingState lines={3} />
        </div>
      )}
      {failed && (
        <div className={styles.mapFallbackNote}>
          <Icon name="pin" size={16} />
          <span>{locale === 'bn' ? 'মানচিত্র লোড না হলে “দিকনির্দেশ” থেকে Google Maps খুলবে।' : 'If the map does not load, use “Directions” to open Google Maps.'}</span>
        </div>
      )}
    </div>
  );
}

function FindUs({ event, siteContact, loading, error, retry }) {
  const { locale, t } = useT();
  const venue = event?.venue || null;
  const siteAddress = t(siteContact?.address);
  const venueName = t(venue?.name);
  const venueSpot = t(venue?.spot);
  const venueAddress = t(venue?.address) || siteAddress;
  const lines = unique([venueName, venueSpot, venueAddress]);
  const mapEmbed = venue?.mapEmbedUrl || siteContact?.mapEmbedUrl;
  const directionHref = venue?.mapUrl || (venueAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lines.join(', '))}` : '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!lines.length && loading) {
    return (
      <section className={styles.card} aria-labelledby="find-us-title">
        <BiTitle id="find-us-title" as="h2" size="sm" bn="আমাদের ঠিকানা" en="Find us" />
        <div className={styles.mapCard}>
          <VenueMap loading title="Loading map" />
          <div className={styles.venueText}>
            <LoadingState lines={3} />
          </div>
        </div>
      </section>
    );
  }

  if (!lines.length && error) {
    return (
      <section className={styles.card} aria-labelledby="find-us-title">
        <BiTitle id="find-us-title" as="h2" size="sm" bn="আমাদের ঠিকানা" en="Find us" />
        <ErrorState error={error} onRetry={retry} />
      </section>
    );
  }

  if (!lines.length) return null;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="find-us-title">
      <BiTitle id="find-us-title" as="h2" size="sm" bn="আমাদের ঠিকানা" en="Find us" />
      <div className={styles.mapCard}>
        <VenueMap mapEmbedUrl={mapEmbed} title={locale === 'bn' ? `${venueName || 'পার্বণ'} মানচিত্র` : `Map for ${venueName || 'Parbon'}`} loading={loading && !venueName} />
        <div className={styles.venueText}>
          <strong>{venueName || (locale === 'bn' ? 'অনুষ্ঠানের ঠিকানা' : 'Event venue')}</strong>
          {venueSpot && <span>{venueSpot}</span>}
          <address>{venueAddress}</address>
          <div className={styles.actionRow}>
            {directionHref && (
              <Button href={directionHref} size="sm" arrow>
                {locale === 'bn' ? 'দিকনির্দেশ' : 'Directions'}
              </Button>
            )}
            <button type="button" className={styles.copyButton} onClick={copyAddress}>
              <Icon name="copy" size={16} /> {copied ? (locale === 'bn' ? 'কপি হয়েছে' : 'Copied') : (locale === 'bn' ? 'ঠিকানা কপি' : 'Copy address')}
            </button>
          </div>
          {siteAddress && siteAddress !== venueAddress && (
            <div className={styles.addressNote}>
              <p className={styles.sectionLabel}>{locale === 'bn' ? 'সমিতির সাধারণ ঠিকানা' : 'Samity contact address'}</p>
              <p>{siteAddress}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ContactPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const site = useApi('site', contentApi.site);
  const featured = useApi('featured-event:v2-contact', contentApi.featuredEvent);
  const data = site.data;
  const contact = data?.contact || {};
  const people = contact.people || [];
  const socials = (data?.social || []).filter((social) => social.url);
  const featuredEvent = featured.data?.data;

  return (
    <>
      <Seo title="Contact" description="Get in touch with Parbon Sanskritik Samity about Puja, volunteering, membership, sponsorship or performances." />
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>{t(contactCopy.hero.eyebrow)}</p>
          <BiTitle bn={contactCopy.hero.title.bn} en={contactCopy.hero.title.en} />
          <p className={styles.intro}>{t(contactCopy.hero.intro)}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`container ${styles.grid}`}>
          <div className={styles.stack}>
            {site.loading && !data && <LoadingState lines={4} />}
            {site.error && !data && <ErrorState error={site.error} onRetry={site.retry} />}

            {contact.whatsappCommunity && (
              <a className={`${styles.card} ${styles.community}`} href={contact.whatsappCommunity} target="_blank" rel="noopener noreferrer">
                <span className={styles.communityIcon}><Icon name="whatsapp" size={24} /></span>
                <span>
                  <strong>{t({ en: 'WhatsApp community', bn: 'WhatsApp কমিউনিটি' })}</strong>
                  <small>{t({ en: 'Fast updates, reminders and community adda.', bn: 'দ্রুত খবর, মনে করিয়ে দেওয়া আর কমিউনিটির আড্ডা।' })}</small>
                </span>
                <Icon name="arrow" size={19} />
              </a>
            )}

            <GeneralContactCard contact={contact} people={people} socials={socials} />

            <section className={`${styles.card} ${styles.formCard}`} aria-labelledby="form-title">
              <BiTitle id="form-title" as="h2" size="sm" bn="বার্তা পাঠান" en="Send a message" />
              <p className={styles.contactIntro}>{t({ en: 'Tell us what you need and the right person will reply.', bn: 'আপনার প্রয়োজন লিখুন—সমিতির সঠিক সদস্য উত্তর দেবেন।' })}</p>
              <InquiryForm key={params.get('type') || 'general'} initialType={params.get('type') || 'general'} />
            </section>
          </div>

          <div className={styles.stack}>
            <FindUs event={featuredEvent} siteContact={contact} loading={featured.loading} error={featured.error} retry={featured.retry} />
          </div>
        </div>
      </section>
    </>
  );
}
