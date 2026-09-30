import styles from './PreviewBadge.module.css';
import { getUiVersion } from './versions.js';

function resetHref() {
  const url = new URL(window.location.href);
  url.searchParams.set('ui', 'reset');
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function PreviewBadge() {
  const preview = document.querySelector('meta[name="parbon-ui-preview"]')?.getAttribute('content') === '1';
  if (!preview) return null;

  return (
    <a className={styles.badge} href={resetHref()} aria-label={`Viewing ${getUiVersion()}. Switch back to the configured UI version.`}>
      Viewing {getUiVersion()} · switch back
    </a>
  );
}
