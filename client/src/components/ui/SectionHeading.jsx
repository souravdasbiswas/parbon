import { useLocale } from '../../i18n/LocaleContext.jsx';
import LotusDivider from '../motifs/LotusDivider.jsx';
import styles from './SectionHeading.module.css';

/**
 * Bilingual section heading: Bengali title for emotion, English line for clarity.
 * `title` is a localized field { bn, en }.
 */
export default function SectionHeading({
  eyebrow,
  title,
  intro,
  as: Heading = 'h2',
  align = 'center',
  tone = 'light',
  divider = false,
  id,
  className = '',
}) {
  const { t } = useLocale();
  return (
    <header className={`${styles.heading} ${styles[align]} ${styles[tone]} ${className}`}>
      {eyebrow && <p className={styles.eyebrow}>{t(eyebrow)}</p>}
      <Heading id={id} className={styles.title}>
        {title.bn && (
          <span lang="bn" className={styles.bn}>
            {title.bn}
          </span>
        )}
        {title.en && <span className={styles.en}>{title.en}</span>}
      </Heading>
      {divider && <LotusDivider className={styles.divider} />}
      {intro && <p className={styles.intro}>{t(intro)}</p>}
    </header>
  );
}
