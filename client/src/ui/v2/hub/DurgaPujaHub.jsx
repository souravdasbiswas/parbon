import Button from '../../../components/ui/Button.jsx';
import SectionHeading from '../../../components/ui/SectionHeading.jsx';
import { durgaPuja, home } from '../../../content/pages.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import EventHub from './EventHub.jsx';
import styles from './EventHub.module.css';

function PujaExtras() {
  const { t } = useLocale();
  return (
    <div className={styles.pujaExtras}>
      <section className={styles.section} aria-labelledby="meaning-title">
        <SectionHeading id="meaning-title" eyebrow={durgaPuja.meaning.eyebrow} title={durgaPuja.meaning.title} align="start" />
        <div className={styles.extraGrid}>
          <div className={styles.proseStack}>{durgaPuja.meaning.body.map((p, i) => <p key={i} className={styles.prose}>{t(p)}</p>)}</div>
          <figure className={styles.quoteCard}>
            <blockquote>
              <p lang="bn">{home.quote.text.bn}</p>
              <p>{home.quote.text.en}</p>
            </blockquote>
            <figcaption>— {home.quote.source.en}</figcaption>
          </figure>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="visit-title">
        <SectionHeading id="visit-title" eyebrow={durgaPuja.visit.eyebrow} title={durgaPuja.visit.title} intro={durgaPuja.visit.intro} />
        <dl className={styles.visitNotes}>{durgaPuja.visit.items.map((item) => <div key={item.title.en}><dt>{t(item.title)} <span lang="bn">{item.title.bn}</span></dt><dd>{t(item.text)}</dd></div>)}</dl>
        <div className={styles.aboutActions}><Button to="/get-involved#volunteer">Volunteer for the Puja</Button><Button to="/get-involved#sponsorship" variant="secondary">Support the Puja</Button></div>
      </section>
      <section className={styles.farewell} aria-label="Farewell"><p lang="bn">{durgaPuja.farewell.bn}</p><p>{durgaPuja.farewell.en}</p></section>
    </div>
  );
}

export default function DurgaPujaHub() {
  return <EventHub slug="durga-puja-2026" afterHighlights={<PujaExtras />} />;
}
