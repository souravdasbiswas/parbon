import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Fades in elements with the `.reveal` class as they scroll into view.
 * Re-scans on every route change. No-ops gracefully without IntersectionObserver.
 */
export function useRevealOnScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (!('IntersectionObserver' in window)) return undefined;
    root.classList.add('js');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    const observe = () =>
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el));
    observe();

    // Content that arrives later (API data) is picked up too.
    const mutations = new MutationObserver(observe);
    mutations.observe(document.getElementById('main') || document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);
}
