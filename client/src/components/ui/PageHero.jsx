import { useLocale } from '../../i18n/LocaleContext.jsx';
import Alpana from '../motifs/Alpana.jsx';
import PaarBorder from '../motifs/PaarBorder.jsx';
import styles from './PageHero.module.css';

/**
 * Hero band for inner pages: bilingual H1, short intro, faint alpana in the background.
 * Pass `art` to show an illustration on the right, with the alpana turning behind it.
 */
export default function PageHero({ eyebrow, title, intro, art, children }) {
  const { t } = useLocale();
  return (
    <section className={`${styles.hero} ${art ? styles.withArt : ''}`} aria-labelledby="page-title">
      {!art && <Alpana className={styles.alpana} strokeWidth={0.9} />}
      <div className={`container ${styles.layout}`}>
        <div className={styles.inner}>
          {eyebrow && <p className={styles.eyebrow}>{t(eyebrow)}</p>}
          <h1 id="page-title" className={styles.title}>
            <span lang="bn" className={styles.bn}>
              {title.bn}
            </span>
            <span className={styles.en}>{title.en}</span>
          </h1>
          {intro && <p className={styles.intro}>{t(intro)}</p>}
          {intro?.bn && (
            <p lang="bn" className={styles.introBn}>
              {intro.bn}
            </p>
          )}
          {children}
        </div>
        {art && <div className={styles.art}>{art}</div>}
      </div>
      <PaarBorder className={styles.border} />
    </section>
  );
}
