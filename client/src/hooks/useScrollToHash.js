import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Scrolls to the element referenced by the URL hash once `ready` is true —
 * needed for sections that render after their data arrives from the API.
 */
export function useScrollToHash(ready) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [ready, hash]);
}
