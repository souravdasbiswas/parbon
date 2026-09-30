import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { PronamiProvider } from '../../components/donate/PronamiDialog.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Icon from '../../components/motifs/Icon.jsx';
import Logo from '../../components/ui/Logo.jsx';
import { LoadingState } from '../../components/ui/States.jsx';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { useT } from './BiTitle.jsx';
import { shellCopy } from './copy.js';
import { SponsorProvider, useSponsor } from './SponsorSheet.jsx';
import styles from './V2Layout.module.css';

const scrollKey = (location) => (location.key === 'default' ? `default:${location.pathname}${location.search}` : location.key);

const primaryNav = [
  { to: '/', key: 'home', icon: 'dhak', end: true },
  { to: '/events', key: 'events', icon: 'calendar' },
  { to: '/passes', key: 'passes', icon: 'check' },
  { to: '/contact', key: 'contact', icon: 'phone' },
];

const overflowNav = [
  { to: '/about', key: 'about' },
  { to: '/durga-puja', key: 'durgaPuja' },
  { to: '/announcements', key: 'updates' },
  { to: '/gallery', key: 'gallery' },
  { to: '/get-involved', key: 'involved' },
];

function LanguageSwitch() {
  const { locale, setLocale, t } = useT();
  return (
    <div className={styles.lang} role="group" aria-label={t(shellCopy.language)}>
      <button type="button" className={locale === 'en' ? styles.langOn : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
        EN
      </button>
      <button type="button" className={locale === 'bn' ? styles.langOn : ''} aria-pressed={locale === 'bn'} onClick={() => setLocale('bn')}>
        বাং
      </button>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className={styles.brand}>
      <Logo width={72} alt="" className={styles.logo} />
      <span className={styles.wordmark}>
        <span lang="bn">{shellCopy.brand.bn}</span>
        <small>{shellCopy.tagline.en}</small>
      </span>
      <span className="visually-hidden"> — Home</span>
    </Link>
  );
}

function OverflowMenu({ desktop = false }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const { t } = useT();
  const id = desktop ? 'v2-more-menu' : 'v2-mobile-menu';

  useEffect(() => {
    if (!open) return undefined;
    const first = menuRef.current?.querySelector('a,button');
    window.setTimeout(() => first?.focus(), 0);
    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.moreWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={desktop ? styles.moreButton : styles.kebab}
        aria-haspopup="menu"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {desktop ? (
          <>
            {t(shellCopy.nav.more)} <span aria-hidden="true">▾</span>
          </>
        ) : (
          <span aria-hidden="true">⋮</span>
        )}
        <span className="visually-hidden">{t(shellCopy.nav.more)}</span>
      </button>
      {open && (
        <nav id={id} ref={menuRef} className={styles.moreMenu} aria-label={t(shellCopy.nav.more)}>
          {overflowNav.map((item) => (
            <NavLink key={item.key} to={item.to} onClick={() => setOpen(false)}>
              {t(shellCopy.overflow[item.key])}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

function MobileHeader() {
  return (
    <header className={`${styles.header} ${styles.mobileHeader}`}>
      <Brand />
      <LanguageSwitch />
      <OverflowMenu />
    </header>
  );
}

function DesktopHeader() {
  const { t } = useT();
  return (
    <header className={`${styles.header} ${styles.desktopHeader}`}>
      <div className={styles.desktopInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink key={item.key} to={item.to} end={item.end} className={({ isActive }) => (isActive ? styles.active : undefined)}>
              {t(shellCopy.nav[item.key])}
            </NavLink>
          ))}
          <OverflowMenu desktop />
        </nav>
        <LanguageSwitch />
        <Link to="/give" className={styles.giveTop}>
          <Icon name="lamp" size={18} />
          {t(shellCopy.nav.give)}
        </Link>
      </div>
    </header>
  );
}

function TabBar({ hidden }) {
  const { t } = useT();
  if (hidden) return null;
  const tabs = [
    { to: '/', key: 'home', icon: 'dhak', end: true },
    { to: '/events', key: 'events', icon: 'calendar' },
    { to: '/give', key: 'give', icon: 'lamp', raised: true },
    { to: '/passes', key: 'passes', icon: 'check' },
    { to: '/contact', key: 'contact', icon: 'phone' },
  ];
  return (
    <nav className={styles.tabbar} aria-label="Primary">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `${styles.tab} ${tab.raised ? styles.tabRaised : ''} ${isActive ? styles.tabActive : ''}`}
        >
          <span className={styles.tabIcon}>
            <Icon name={tab.icon} size={tab.raised ? 24 : 21} />
          </span>
          <span>{t(shellCopy.nav[tab.key])}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function V2LocaleBootstrap() {
  const { setLocale } = useLocale();
  useEffect(() => {
    try {
      if (window.localStorage.getItem('parbon.locale')) return;
    } catch {
      return;
    }
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (languages.some((lang) => String(lang).toLowerCase().startsWith('bn'))) setLocale('bn');
  }, [setLocale]);
  return null;
}

function ShellFrame() {
  const { pathname } = useLocation();
  const sponsor = useSponsor();
  const { t } = useT();
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  const tabHidden = /^\/c\/[\w-]+/.test(pathname) || sponsor.isOpen;

  useRevealOnScroll();

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector('h1');
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    (heading || mainRef.current)?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <V2LocaleBootstrap />
      <a href="#main" className={styles.skip}>
        {t(shellCopy.skip)}
      </a>
      <MobileHeader />
      <DesktopHeader />
      <main id="main" ref={mainRef} tabIndex={-1} className={`${styles.main} ${tabHidden ? '' : styles.withTab}`}>
        <Suspense
          fallback={
            <div className={`container section ${styles.fallback}`}>
              <LoadingState lines={4} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <div className={tabHidden ? '' : styles.footerLift}>
        <Footer />
      </div>
      <TabBar hidden={tabHidden} />
      <ScrollRestoration getKey={scrollKey} />
    </>
  );
}

export default function V2Layout() {
  return (
    <PronamiProvider>
      <SponsorProvider>
        <ShellFrame />
      </SponsorProvider>
    </PronamiProvider>
  );
}
