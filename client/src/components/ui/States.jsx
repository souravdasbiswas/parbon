import { useLocale } from '../../i18n/LocaleContext.jsx';
import Alpana from '../motifs/Alpana.jsx';
import Button from './Button.jsx';
import styles from './States.module.css';

export function LoadingState({ label = 'Loading…', lines = 3 }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.skeleton} style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className={styles.error} role="alert">
      <p lang="bn" className={styles.bn}>
        দুঃখিত, কিছু একটা গোলমাল হয়েছে।
      </p>
      <p>{error?.message || 'Something went wrong while loading this section.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, text, children }) {
  const { t } = useLocale();
  return (
    <div className={styles.empty}>
      <Alpana className={styles.emptyArt} strokeWidth={1.4} />
      {title && (
        <p className={styles.emptyTitle}>
          {title.bn && (
            <span lang="bn" className={styles.bn}>
              {title.bn}
            </span>
          )}
          {title.en && <span>{title.en}</span>}
        </p>
      )}
      {text && <p className={styles.emptyText}>{t(text)}</p>}
      {children}
    </div>
  );
}
