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

function DirectRows({ contact }) {
  const { locale, t } = useT();
  const phone = cleanPhone(contact?.phone);
  const whatsapp = contact?.whatsapp ? waHref(contact.whatsapp) : '';
  const rows = [
    contact?.email && { icon: 'mail', label: contact.email, href: `mailto:${contact.email}` },
    phone && { icon: 'phone', label: contact.phone, href: `tel:${phone}` },
    whatsapp && { icon: 'whatsapp', label: 'WhatsApp', href: whatsapp, external: true },
    t(contact?.address) && { icon: 'pin', label: t(contact.address) },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <ul className={styles.directRows} role="list">
      {rows.map((row) => (
        <li key={`${row.icon}-${row.label}`}>
          <Icon name={row.icon} size={20} />
          {row.href ? <a href={row.href} {...(row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{row.label}</a> : <span>{row.label}</span>}
          {row.icon === 'mail' && <small>{t(contact?.responseTime) || (locale === 'bn' ? 'সাধারণত দুই কর্মদিবসের মধ্যে উত্তর দিই।' : 'We usually reply within two working days.')}</small>}
        </li>
      ))}
    </ul>
  );
}

function FindUs({ event, siteContact }) {
  const { locale, t } = useT();
  const venue = event?.venue;
  const mapEmbed = siteContact?.mapEmbedUrl || venue?.mapEmbedUrl;
  if (!venue?.name && !t(siteContact?.address)) return null;
  return (
    <section className={styles.card} aria-labelledby="find-us-title">
      <BiTitle id="find-us-title" as="h2" size="sm" bn="আমাদের ঠিকানা" en="Find us" />
      <div className={styles.mapCard}>
        <div className={styles.staticMap} aria-hidden="true"><span /></div>
        {mapEmbed && <iframe className={styles.desktopMap} src={mapEmbed} title="Map showing venue" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
        <div className={styles.venueText}>
          <strong>{t(venue?.name) || t(siteContact?.address)}</strong>
          {venue?.spot && <span>{t(venue.spot)}</span>}
          {(venue?.address || siteContact?.address) && <address>{t(venue?.address) || t(siteContact?.address)}</address>}
          {venue?.mapUrl && <Button href={venue.mapUrl} size="sm" arrow>{locale === 'bn' ? 'দিকনির্দেশ' : 'Directions'}</Button>}
        </div>
      </div>
    </section>
  );
}

export default function ContactPage() {
  const { locale, t } = useT();
  const [params] = useSearchParams();
  const site = useApi('site', contentApi.site);
  const featured = useApi('featured-event:v2-contact', contentApi.featuredEvent);
  const data = site.data;
  const contact = data?.contact || {};
  const people = contact.people || [];
  const socials = (data?.social || []).filter((s) => s.url);
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
            {site.loading && <LoadingState lines={4} />}
            {site.error && <ErrorState error={site.error} onRetry={site.retry} />}

            {contact.whatsappCommunity && (
              <a className={`${styles.card} ${styles.community}`} href={contact.whatsappCommunity} target="_blank" rel="noopener noreferrer">
                <span className={styles.communityIcon}><Icon name="whatsapp" size={24} /></span>
                <span><strong>{locale === 'bn' ? 'WhatsApp কমিউনিটি' : 'WhatsApp community'}</strong><small>{locale === 'bn' ? 'আপডেট ও কমিউনিটি কথোপকথন' : 'Updates and community conversations'}</small></span>
                <Icon name="arrow" size={19} />
              </a>
            )}

            <section className={styles.card} aria-labelledby="committee-title">
              <BiTitle id="committee-title" as="h2" size="sm" bn="সমিতির সঙ্গে কথা বলুন" en="Committee contacts" />
              {people.length > 0 ? (
                <ul className={styles.people} role="list">
                  {people.map((person) => <PersonRow key={person.id || t(person.name)} person={person} />)}
                </ul>
              ) : (
                <DirectRows contact={contact} />
              )}
            </section>

            {contact.email && (
              <section className={styles.card} aria-labelledby="email-title">
                <BiTitle id="email-title" as="h2" size="sm" bn="ইমেল" en="Email us" />
                <a className={styles.emailRow} href={`mailto:${contact.email}`}>
                  <Icon name="mail" size={22} />
                  <span><strong>{contact.email}</strong><small>{t(contact.responseTime) || 'We usually reply within two working days.'}</small></span>
                </a>
              </section>
            )}

            {socials.length > 0 && (
              <section className={styles.card} aria-labelledby="social-title">
                <BiTitle id="social-title" as="h2" size="sm" bn="সঙ্গে থাকুন" en="Follow Parbon" />
                <div className={styles.socials}>
                  {socials.map((s) => <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"><Icon name={s.platform} size={19} /> {s.label}</a>)}
                </div>
              </section>
            )}

            <FindUs event={featuredEvent} siteContact={contact} />
          </div>

          <section className={`${styles.card} ${styles.formCard}`} aria-labelledby="message-title">
            <BiTitle id="message-title" as="h2" size="md" bn="আমাদের লিখুন" en="Send a message" />
            <InquiryForm key={params.get('type') || 'general'} initialType={params.get('type') || 'general'} />
          </section>
        </div>
      </section>
    </>
  );
}
