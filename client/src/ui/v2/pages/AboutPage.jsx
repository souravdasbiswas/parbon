import PaarBorder from '../../../components/motifs/PaarBorder.jsx';
import { home } from '../../../content/pages.js';
import { useLocale } from '../../../i18n/LocaleContext.jsx';
import LegacyAbout from '../../../pages/About.jsx';
import BiTitle from '../BiTitle.jsx';
import styles from './AboutPage.module.css';

const PILLAR_ART = {
  music: '/brand/coupon-notes.png',
  book: '/brand/coupon-palash.png',
  alpana: '/brand/coupon-alpana-red.png',
  bhog: '/brand/coupon-banana-leaf.png',
  lamp: '/brand/coupon-dhak.png',
  people: '/brand/coupon-shiuli.png',
};

function PillarCard({ item }) {
  const { t } = useLocale();
  const art = PILLAR_ART[item.icon] || '/brand/coupon-alpana-gold.png';
  return (
    <article className={styles.pillarCard}>
      <div className={styles.pillarArtWrap}>
        <img src={art} alt="" loading="lazy" decoding="async" />
      </div>
      <h3>
        <span lang="bn">{item.title.bn}</span>
        <em>{item.title.en}</em>
      </h3>
      <p>{t(item.text)}</p>
    </article>
  );
}

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
            {home.story.body.map((item, index) => (
              <article key={item.en} className={styles.storyCard}>
                <img src={index === 0 ? '/brand/coupon-shiuli.png' : '/brand/coupon-moon.png'} alt="" loading="lazy" decoding="async" />
                <div>
                  <p>{t(item)}</p>
                  <p lang="bn">{item.bn}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.pillars} aria-labelledby="pillars-title">
        <div className="container">
          <p className={styles.eyebrow}>{t(home.pillars.eyebrow)}</p>
          <BiTitle id="pillars-title" as="h2" size="md" bn={home.pillars.title.bn} en={home.pillars.title.en} />
          <div className={styles.pillarGrid}>
            {home.pillars.items.map((item) => <PillarCard key={item.icon} item={item} />)}
          </div>
        </div>
      </section>

      <section className={styles.quote} aria-label="Chandi quote">
        <div className={`container ${styles.quoteWrap}`}>
          <div className={styles.quoteInner}>
            <PaarBorder className={styles.paar} />
            <img className={styles.quoteArtLeft} src="/brand/coupon-lotus.png" alt="" loading="lazy" decoding="async" />
            <img className={styles.quoteArtRight} src="/brand/coupon-alpana-gold.png" alt="" loading="lazy" decoding="async" />
            <blockquote>
              <p lang="bn">{home.quote.text.bn}</p>
              <p>{t(home.quote.text)}</p>
              <cite>{t(home.quote.source)}</cite>
            </blockquote>
          </div>
        </div>
      </section>
    </>
  );
}
