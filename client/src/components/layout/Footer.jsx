import { Link } from 'react-router';
import { BRAND, CONTACT_NAV, NAV_ITEMS } from '../../content/navigation.js';
import { useApi } from '../../hooks/useApi.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { contentApi } from '../../services/api.js';
import Alpana from '../motifs/Alpana.jsx';
import Icon from '../motifs/Icon.jsx';
import PaarBorder from '../motifs/PaarBorder.jsx';
import Logo from '../ui/Logo.jsx';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useLocale();
  const { data: site } = useApi('site', contentApi.site);
  const contact = site?.contact;
  const socials = (site?.social || []).filter((s) => s.url);
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <PaarBorder tone="dark" />
      <Alpana className={styles.alpana} strokeWidth={0.8} />
      <div className={`container ${styles.grid}`}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logoCard} aria-label="Parbon Sanskritik Samity — Home">
            <Logo width={120} alt="" />
          </Link>
          <div>
            <p lang="bn" className={styles.tagBn}>
              {BRAND.tagline.bn}
            </p>
            <p className={styles.tagEn}>{BRAND.tagline.en}</p>
          </div>
        </div>

        <nav aria-label="Footer" className={styles.col}>
          <h2 className={styles.heading}>
            <span lang="bn">পথনির্দেশ</span> <span className={styles.headingEn}>Explore</span>
          </h2>
          <ul role="list" className={styles.links}>
            {[...NAV_ITEMS, CONTACT_NAV].map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{t(item.label)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={styles.heading}>
            <span lang="bn">যোগাযোগ</span> <span className={styles.headingEn}>Contact</span>
          </h2>
          <ul role="list" className={styles.links}>
            {contact?.email && (
              <li>
                <a href={`mailto:${contact.email}`} className={styles.iconLink}>
                  <Icon name="mail" size={18} /> {contact.email}
                </a>
              </li>
            )}
            {contact?.phone && (
              <li>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.iconLink}>
                  <Icon name="phone" size={18} /> {contact.phone}
                </a>
              </li>
            )}
            {t(contact?.address) && (
              <li className={styles.iconLink}>
                <Icon name="pin" size={18} /> {t(contact.address)}
              </li>
            )}
            <li>
              <Link to="/contact" className={styles.iconLink}>
                <Icon name="arrow" size={18} /> Write to us
              </Link>
            </li>
          </ul>
          {socials.length > 0 && (
            <ul role="list" className={styles.socials} aria-label="Social media">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={styles.social}>
                    <Icon name={s.platform} size={20} title={s.label} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>
          © {year} {BRAND.name.en} · <span lang="bn">{BRAND.name.bn}</span>
        </p>
        <p lang="bn" className={styles.signoff}>
          ভালোবাসায়, বাংলার জন্য
        </p>
      </div>
    </footer>
  );
}
