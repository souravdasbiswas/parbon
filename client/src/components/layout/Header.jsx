import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { CONTACT_NAV, NAV_ITEMS } from '../../content/navigation.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import Icon from '../motifs/Icon.jsx';
import Button from '../ui/Button.jsx';
import Logo from '../ui/Logo.jsx';
import styles from './Header.module.css';

export default function Header() {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const toggle = toggleRef.current;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('a')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      toggle?.focus();
    };
  }, [open]);

  const linkClass = ({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`;

  return (
    <header className={`${styles.header} ${scrolled || open ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand}>
          <Logo width={44} alt="" loading="eager" className={styles.logo} />
          <span className={styles.wordmark}>
            <span lang="bn" className={styles.wordmarkBn}>
              পার্বণ
            </span>
            <span className={styles.wordmarkEn}>Sanskritik Samity</span>
            <span className="visually-hidden"> — Home</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <ul role="list" className={styles.list}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={linkClass}>
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Button to={CONTACT_NAV.to} size="sm" className={styles.cta}>
          {t(CONTACT_NAV.label)}
        </Button>

        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'close' : 'menu'} size={26} />
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>

      <div id="mobile-menu" ref={panelRef} className={`${styles.panel} ${open ? styles.panelOpen : ''}`} hidden={!open}>
        <nav aria-label="Mobile">
          <ul role="list" className={styles.mobileList}>
            {[...NAV_ITEMS, CONTACT_NAV].map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `${styles.mobileLink} ${isActive ? styles.active : ''}`}>
                  <span>{t(item.label)}</span>
                  <span lang="bn" className={styles.mobileBn}>
                    {item.label.bn}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
