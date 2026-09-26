import FeatureCard, { FeatureGrid } from '../components/ui/FeatureCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import Button from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import Logo from '../components/ui/Logo.jsx';
import { about } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import styles from './About.module.css';

export default function About() {
  const { t } = useLocale();
  const committee = useApi('committee', contentApi.committee);
  const members = committee.data?.members || [];

  return (
    <>
      <Seo
        title="About Us"
        description="The story of Parbon Sanskritik Samity — a Bengali cultural community built on friendship, tradition and celebrating together."
      />
      <PageHero {...about.hero} />

      <section className="section section--paper" aria-label="Our story">
        <div className={`container ${styles.storyGrid}`}>
          <div className={`${styles.story} reveal`}>
            {about.story.map((p, i) => (
              <div key={i} className={styles.para}>
                <p className={i === 0 ? styles.first : undefined}>{t(p)}</p>
                <p lang="bn" className={styles.bn}>
                  {p.bn}
                </p>
              </div>
            ))}
          </div>
          <aside className={`${styles.aside} reveal`} aria-label="The meaning of Parbon">
            <div className={styles.logoCard}>
              <Logo width={200} alt="Parbon Sanskritik Samity logo" />
            </div>
            <dl className={styles.meaning}>
              <dt lang="bn">পার্বণ</dt>
              <dd>
                <em>noun</em> — a festival; a sacred day of celebration. From the Bengali saying{' '}
                <span lang="bn">“বারো মাসে তেরো পার্বণ”</span> — thirteen festivals in twelve months.
              </dd>
            </dl>
          </aside>
        </div>
      </section>

      <section className="section" aria-labelledby="values-title">
        <div className="container">
          <SectionHeading id="values-title" eyebrow={about.values.eyebrow} title={about.values.title} />
          <FeatureGrid min="240px">
            {about.values.items.map((v) => (
              <FeatureCard key={v.icon} {...v} />
            ))}
          </FeatureGrid>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="journey-title">
        <div className="container-narrow">
          <SectionHeading id="journey-title" eyebrow={about.journey.eyebrow} title={about.journey.title} />
          <ol className={styles.timeline} role="list">
            {about.journey.items.map((item) => (
              <li key={item.label.en} className={`${styles.step} ${item.current ? styles.current : ''} reveal`}>
                <span className={styles.dot} aria-hidden="true" />
                <p className={styles.stepLabel}>
                  <span lang="bn">{item.label.bn}</span> · {item.label.en}
                </p>
                <h3 className={styles.stepTitle}>{t(item.title)}</h3>
                <p lang="bn" className={styles.stepTitleBn}>
                  {item.title.bn}
                </p>
                <p className={styles.stepText}>{t(item.text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="team-title">
        <div className="container">
          <SectionHeading
            id="team-title"
            eyebrow={about.team.eyebrow}
            title={about.team.title}
            intro={committee.data?.intro}
          />
          {members.length > 0 ? (
            <ul className={styles.team} role="list">
              {members.map((m) => (
                <li key={m.id || m.name.en} className={`${styles.member} reveal`}>
                  {m.photo ? (
                    <img src={m.photo} alt="" width="160" height="160" loading="lazy" className={styles.photo} />
                  ) : (
                    <span className={styles.initials} aria-hidden="true">
                      {t(m.name).slice(0, 1)}
                    </span>
                  )}
                  <p className={styles.memberName}>{t(m.name)}</p>
                  {m.name.bn && (
                    <p lang="bn" className={styles.memberNameBn}>
                      {m.name.bn}
                    </p>
                  )}
                  <p className={styles.role}>{t(m.role)}</p>
                </li>
              ))}
            </ul>
          ) : (
            !committee.loading && (
              <EmptyState text={about.team.empty}>
                <Button to="/get-involved" variant="secondary" size="sm">
                  Get involved
                </Button>
              </EmptyState>
            )
          )}
        </div>
      </section>
    </>
  );
}
