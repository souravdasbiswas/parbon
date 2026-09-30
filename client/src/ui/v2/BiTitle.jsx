/* eslint-disable react-refresh/only-export-components -- BiTitle and useT are intentionally paired for the v2 i18n API. */
import { formatDate, toBengaliDigits } from '../../i18n/format.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import styles from './BiTitle.module.css';

// v2 display rule: headings stay bilingual; buttons, dates, prices, addresses and paragraphs use single-locale t().
export function useT() {
  const { locale, setLocale, t } = useLocale();
  return {
    locale,
    setLocale,
    t,
    digits: (value) => (locale === 'bn' ? toBengaliDigits(value) : String(value)),
    date: (iso, options) => formatDate(iso, locale, options),
  };
}

export default function BiTitle({ bn, en, as: Tag = 'h1', size = 'lg', tone = 'default', className = '', id }) {
  return (
    <Tag id={id} className={`${styles.title} ${styles[size]} ${styles[tone]} ${className}`}>
      <span lang="bn" className={styles.bn}>
        {bn}
      </span>
      <span className={styles.en}>{en}</span>
    </Tag>
  );
}
