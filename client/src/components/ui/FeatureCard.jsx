import { useLocale } from '../../i18n/LocaleContext.jsx';
import Icon from '../motifs/Icon.jsx';
import styles from './FeatureCard.module.css';

/** Icon + bilingual title + short text. Used for pillars, values, highlights and roles. */
export default function FeatureCard({ icon, title, text, tone = 'light', as: H = 'h3', children }) {
  const { t } = useLocale();
  return (
    <article className={`${styles.card} ${styles[tone]} reveal`}>
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size={28} />
        </span>
      )}
      <H className={styles.title}>
        {title.bn && (
          <span lang="bn" className={styles.bn}>
            {title.bn}
          </span>
        )}
        <span className={styles.en}>{title.en}</span>
      </H>
      {text && <p className={styles.text}>{t(text)}</p>}
      {children}
    </article>
  );
}

export function FeatureGrid({ children, min = '240px', className = '' }) {
  return (
    <div className={`${styles.grid} ${className}`} style={{ '--min': min }}>
      {children}
    </div>
  );
}
