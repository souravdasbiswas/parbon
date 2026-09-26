import Alpana from '../components/motifs/Alpana.jsx';
import Button from '../components/ui/Button.jsx';
import Seo from '../components/ui/Seo.jsx';
import { notFound as copy } from '../content/pages.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import styles from './NotFound.module.css';

export default function NotFound() {
  const { t } = useLocale();
  return (
    <section className={styles.wrap} aria-labelledby="page-title">
      <Seo title="Page not found" noindex />
      <Alpana className={styles.art} strokeWidth={1} />
      <h1 id="page-title" className={styles.title}>
        <span lang="bn">{copy.title.bn}</span>
        <span className={styles.en}>{copy.title.en}</span>
      </h1>
      <p className={styles.text}>{t(copy.text)}</p>
      <p lang="bn" className={styles.textBn}>
        {copy.text.bn}
      </p>
      <Button to="/" arrow>
        {t(copy.cta)}
      </Button>
    </section>
  );
}
