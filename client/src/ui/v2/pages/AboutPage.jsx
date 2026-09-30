import FeatureCard, { FeatureGrid } from '../../../components/ui/FeatureCard.jsx';
import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import { home } from '../../../content/pages.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import LegacyAbout from '../../../pages/About.jsx';
import BiTitle from '../BiTitle.jsx';
import styles from './AboutPage.module.css';

export default function AboutPage() {
  const { t } = useLocale();
  return (
    <>
      <LegacyAbout />

      <section className={styles.story} aria-labelledby="home-story-title">
        <div className="container">
          <p className={styles.eyebrow}>{t(home.story.eyebrow)}</p>
          <BiTitle id="home-story-title" as="h2" size="md" bn={home.story.title.bn} en={home.story.title.en} />
          <div className={styles.storyGrid}>
            {home.story.body.map((item) => (
              <article key={item.en} className={styles.storyCard}>
                <p>{t(item)}</p>
                <p lang="bn">{item.bn}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.pillars} aria-labelledby="pillars-title">
        <div className="container">
          <p className={styles.eyebrow}>{t(home.pillars.eyebrow)}</p>
          <BiTitle id="pillars-title" as="h2" size="md" bn={home.pillars.title.bn} en={home.pillars.title.en} />
          <FeatureGrid min="180px" className={styles.pillarGrid}>
            {home.pillars.items.map((item) => <FeatureCard key={item.icon} {...item} />)}
          </FeatureGrid>
        </div>
      </section>

      <section className={styles.quote} aria-label="Chandi quote">
        <div className={`container ${styles.quoteInner}`}>
          <PaarBorder className={styles.paar} />
          <blockquote>
            <p lang="bn">{home.quote.text.bn}</p>
            <p>{t(home.quote.text)}</p>
            <cite>{t(home.quote.source)}</cite>
          </blockquote>
        </div>
      </section>
    </>
  );
}
