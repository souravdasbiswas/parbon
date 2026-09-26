import { useCountdown } from '../../hooks/useCountdown.js';
import styles from './Countdown.module.css';

const UNITS = [
  { key: 'days', en: 'Days', bn: 'দিন' },
  { key: 'hours', en: 'Hours', bn: 'ঘণ্টা' },
  { key: 'minutes', en: 'Minutes', bn: 'মিনিট' },
  { key: 'seconds', en: 'Seconds', bn: 'সেকেন্ড' },
];

/** Countdown to the Goddess's arrival. Shows a festive greeting once Puja begins. */
export default function Countdown({ target, label, tone = 'light', doneMessage }) {
  const time = useCountdown(target);
  if (!time) return null;

  if (time.done) {
    return (
      <p className={`${styles.done} ${styles[tone]}`}>
        <span lang="bn">{doneMessage?.bn || 'শুভ শারদীয়া'}</span>
        <span>{doneMessage?.en || 'Subho Sharadiya!'}</span>
      </p>
    );
  }

  const summary = `${time.days} days, ${time.hours} hours to go`;

  return (
    <div className={`${styles.countdown} ${styles[tone]}`}>
      {label && (
        <p className={styles.label}>
          <span lang="bn" className={styles.labelBn}>
            {label.bn}
          </span>
          <span className={styles.labelEn}>{label.en}</span>
        </p>
      )}
      <p className="visually-hidden">{summary}</p>
      <ol className={styles.units} role="list" aria-hidden="true">
        {UNITS.map((u) => (
          <li key={u.key} className={styles.unit}>
            <span className={styles.value}>{String(time[u.key]).padStart(2, '0')}</span>
            <span className={styles.unitLabel}>
              <span lang="bn" className={styles.unitBn}>
                {u.bn}
              </span>
              <span>{u.en}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
