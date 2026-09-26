import { formatDate } from '../../i18n/format.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import styles from './Schedule.module.css';

/** Day-by-day festival schedule (nirghanta). */
export default function Schedule({ days = [], note }) {
  const { t } = useLocale();
  if (!days.length) return null;
  return (
    <div className={styles.wrap}>
      <ol className={styles.days} role="list">
        {days.map((d) => (
          <li key={d.date} className={`${styles.day} ${d.items?.length ? '' : styles.minor} reveal`}>
            <div className={styles.when}>
              <time dateTime={d.date} className={styles.date}>
                <span className={styles.dateNum}>{formatDate(d.date, 'en', { day: 'numeric' })}</span>
                <span className={styles.dateMonth}>{formatDate(d.date, 'en', { month: 'short' })}</span>
              </time>
              <span className={styles.weekday}>{formatDate(d.date, 'en', { weekday: 'long' })}</span>
              <span lang="bn" className={styles.weekdayBn}>
                {formatDate(d.date, 'bn', { weekday: 'long' })}
              </span>
            </div>
            <div className={styles.what}>
              <h3 className={styles.title}>
                <span lang="bn" className={styles.titleBn}>
                  {d.day.bn}
                </span>
                <span className={styles.titleEn}>{d.day.en}</span>
              </h3>
              {d.note && <p className={styles.note}>{t(d.note)}</p>}
              {d.items?.length > 0 && (
                <ul className={styles.items} role="list">
                  {d.items.map((item, i) => (
                    <li key={i} className={`${styles.item} ${item.time ? '' : styles.itemNoTime}`}>
                      {item.time && <span className={styles.time}>{item.time}</span>}
                      <span>
                        {t(item.title)}
                        <span lang="bn" className={styles.itemBn}>
                          {item.title.bn}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      {note && (
        <p className={styles.footnote}>
          {t(note)} <span lang="bn">{note.bn}</span>
        </p>
      )}
    </div>
  );
}
