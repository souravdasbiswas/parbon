import { useId } from 'react';

/**
 * "Lal paar" — the red border of a Bengali garad/tant sari — as a decorative band:
 * a vermilion stripe, a fine gold line and a row of small kolka (paisley-like) triangles.
 */
export default function PaarBorder({ className, tone = 'light' }) {
  const id = useId().replace(/:/g, '');
  const red = 'var(--color-vermilion)';
  const gold = tone === 'dark' ? 'var(--color-gold-soft)' : 'var(--color-gold)';
  return (
    <svg className={className} width="100%" height="22" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={`kolka-${id}`} width="24" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 10 L6 2 L12 10 Z M12 10 L18 2 L24 10 Z" fill={red} opacity="0.9" />
          <circle cx="12" cy="3" r="1.3" fill={gold} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="6" fill={red} />
      <rect x="0" y="8" width="100%" height="1" fill={gold} />
      <rect x="0" y="11" width="100%" height="10" fill={`url(#kolka-${id})`} />
    </svg>
  );
}
