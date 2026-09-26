import { Suspense, useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll.js';
import { PronamiProvider } from '../donate/PronamiDialog.jsx';
import { LoadingState } from '../ui/States.jsx';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import styles from './Layout.module.css';

// Stable reference: an inline function would make ScrollRestoration re-subscribe on every render.
const scrollKey = (location) => (location.key === 'default' ? `default:${location.pathname}${location.search}` : location.key);

export default function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useRevealOnScroll();

  // On client-side navigation, move focus to the new page so screen readers announce it.
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
    <PronamiProvider>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
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
      <Footer />
      {/* Fresh page loads all share the key "default"; scope it by URL so a new page never inherits a stale position. */}
      <ScrollRestoration getKey={scrollKey} />
    </PronamiProvider>
  );
}
