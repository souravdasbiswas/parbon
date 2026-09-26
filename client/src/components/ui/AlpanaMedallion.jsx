import Alpana from '../motifs/Alpana.jsx';
import styles from './AlpanaMedallion.module.css';

/** Decorative hero art: a slowly turning alpana with a counter-rotating ring of dots and a warm glow. */
export default function AlpanaMedallion() {
  return (
    <div className={styles.medallion} aria-hidden="true">
      <span className={styles.halo} />
      <Alpana className={styles.alpana} strokeWidth={1} />
      <span className={styles.ringDots} />
    </div>
  );
}
