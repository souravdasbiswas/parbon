import { useSearchParams } from 'react-router';
import InquiryForm from '../components/forms/InquiryForm.jsx';
import Icon from '../components/motifs/Icon.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import Seo from '../components/ui/Seo.jsx';
import VenueCard from '../components/ui/VenueCard.jsx';
import { contact as copy } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import styles from './Contact.module.css';

export default function Contact() {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const { data: site } = useApi('site', contentApi.site);
  const c = site?.contact;
  const socials = (site?.social || []).filter((s) => s.url);
  const whatsapp = c?.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : null;
  const hasDetails = c && (c.email || c.phone || whatsapp || t(c.address));
  const featuredSlug = site?.featuredEvent?.slug;
  const { data: featuredEvent } = useApi(featuredSlug ? `event:${featuredSlug}` : null, () => contentApi.event(featuredSlug));
  const pujaVenue = featuredEvent?.venue;

  return (
    <>
      <Seo
        title="Contact"
        description="Get in touch with Parbon Sanskritik Samity about Durga Puja, volunteering, membership, sponsorship or performing."
      />
      <PageHero {...copy.hero} />

      <section className="section section--paper" aria-label="Contact form and details">
        <div className={`container ${styles.grid}`}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>
              <span lang="bn">আমাদের লিখুন</span>
              <span className={styles.formTitleEn}>Send us a message</span>
            </h2>
            <InquiryForm key={params.get('type') || 'general'} initialType={params.get('type') || 'general'} />
          </div>

          <aside className={styles.aside}>
            {pujaVenue && (
              <div className={styles.venueBlock}>
                <h2 className={styles.blockTitle}>
                  Durga Puja 2026 venue · <span lang="bn">পুজোর মণ্ডপ</span>
                </h2>
                <VenueCard venue={pujaVenue} compact />
              </div>
            )}
            {hasDetails && (
              <div className={styles.block}>
                <h2 className={styles.blockTitle}>{t(copy.details)}</h2>
                <ul role="list" className={styles.details}>
                  {c.email && (
                    <li>
                      <Icon name="mail" size={20} />
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </li>
                  )}
                  {c.phone && (
                    <li>
                      <Icon name="phone" size={20} />
                      <a href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a>
                    </li>
                  )}
                  {whatsapp && (
                    <li>
                      <Icon name="whatsapp" size={20} />
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </li>
                  )}
                  {t(c.address) && (
                    <li>
                      <Icon name="pin" size={20} />
                      <span>{t(c.address)}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className={styles.block}>
              <p lang="bn" className={styles.welcome}>
                আপনার চিঠির অপেক্ষায় রইলাম।
              </p>
              <p className="muted">{t(c?.responseTime) || 'We usually reply within two working days.'}</p>
            </div>

            {socials.length > 0 && (
              <div className={styles.block}>
                <h2 className={styles.blockTitle}>{t(copy.follow)}</h2>
                <ul role="list" className={styles.socials}>
                  {socials.map((s) => (
                    <li key={s.platform}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        <Icon name={s.platform} size={20} /> {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c?.mapEmbedUrl && (
              <iframe
                className={styles.map}
                src={c.mapEmbedUrl}
                title="Map showing our location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
