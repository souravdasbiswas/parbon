import { Link } from 'react-router';
import PronamiPanel from '../components/donate/PronamiPanel.jsx';
import Icon from '../components/motifs/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import FeatureCard, { FeatureGrid } from '../components/ui/FeatureCard.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Seo from '../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { getInvolved as copy } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { useScrollToHash } from '../hooks/useScrollToHash.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import styles from './GetInvolved.module.css';

export default function GetInvolved() {
  const { t } = useLocale();
  const { data, loading, error, retry } = useApi('support', contentApi.support);
  useScrollToHash(Boolean(data));

  return (
    <>
      <Seo
        title="Get Involved"
        description="Volunteer, become a member, sponsor or donate — help Parbon Sanskritik Samity celebrate Durga Puja and Bengali culture."
      />
      <PageHero {...copy.hero} />

      <section className="section section--paper" aria-label="Ways to get involved">
        <div className="container">
          <ul className={styles.paths} role="list">
            {copy.paths.map((p) => {
              const inner = (
                <>
                  <span className={styles.pathIcon}>
                    <Icon name={p.icon} size={30} />
                  </span>
                  <span lang="bn" className={styles.pathBn}>
                    {p.title.bn}
                  </span>
                  <span className={styles.pathEn}>{p.title.en}</span>
                  <span className={styles.pathText}>{t(p.text)}</span>
                  <Icon name="arrow" size={18} className={styles.pathArrow} />
                </>
              );
              return (
                <li key={p.id} className="reveal">
                  {p.href.startsWith('#') ? (
                    <a href={p.href} className={styles.path}>
                      {inner}
                    </a>
                  ) : (
                    <Link to={p.href} className={styles.path}>
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {loading && (
        <div className="container section">
          <LoadingState lines={4} />
        </div>
      )}
      {error && (
        <div className="container section">
          <ErrorState error={error} onRetry={retry} />
        </div>
      )}

      {data && (
        <>
          <section id="volunteer" className="section" aria-labelledby="volunteer-title">
            <div className="container">
              <SectionHeading id="volunteer-title" eyebrow={copy.volunteer.eyebrow} title={copy.volunteer.title} />
              <FeatureGrid min="300px">
                {data.volunteerRoles.map((role) => (
                  <FeatureCard key={role.id} title={role.name} text={role.text} />
                ))}
              </FeatureGrid>
              <div className={styles.center}>
                <Button to="/contact?type=volunteer" arrow size="lg">
                  {t(copy.volunteer.cta)}
                </Button>
              </div>
            </div>
          </section>

          <section id="sponsorship" className="section section--tint" aria-labelledby="sponsorship-title">
            <div className="container">
              <SectionHeading
                id="sponsorship-title"
                eyebrow={copy.sponsorship.eyebrow}
                title={copy.sponsorship.title}
                intro={data.sponsorship.intro}
              />
              <ul className={styles.tiers} role="list">
                {data.sponsorship.tiers.map((tier) => (
                  <li key={tier.id} className={`${styles.tier} ${tier.featured ? styles.tierFeatured : ''} reveal`}>
                    {tier.featured && <span className={styles.badge}>{t(copy.sponsorship.popular)}</span>}
                    <h3 className={styles.tierTitle}>
                      <span lang="bn">{tier.name.bn}</span>
                      <span className={styles.tierEn}>{tier.name.en}</span>
                    </h3>
                    <ul className={styles.benefits} role="list">
                      {tier.benefits.map((b) => (
                        <li key={b.en}>
                          <Icon name="check" size={18} className={styles.check} />
                          <span>
                            {t(b)}
                            <span lang="bn" className={styles.benefitBn}>
                              {b.bn}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {data.sponsorship.note && <p className={styles.note}>{t(data.sponsorship.note)}</p>}
              <div className={styles.center}>
                <Button to="/contact?type=sponsorship" arrow size="lg">
                  {t(copy.sponsorship.cta)}
                </Button>
              </div>
            </div>
          </section>

          <section id="donate" className="section section--paper" aria-labelledby="donate-title">
            <div className="container-narrow">
              <SectionHeading id="donate-title" eyebrow={copy.donate.eyebrow} title={copy.donate.title} intro={data.donation.intro} />
              {data.donation.methods.length > 0 ? (
                <div className={styles.method}>
                  <PronamiPanel showIntro={false} />
                  <p className={styles.methodNote}>
                    For receipts or sponsorship queries, <Link to="/contact?type=sponsorship">write to us</Link>.
                  </p>
                </div>
              ) : (
                <div className={styles.fallback}>
                  <Icon name="lamp" size={36} />
                  <p>{t(data.donation.fallback)}</p>
                  <p lang="bn" className={styles.fallbackBn}>
                    {data.donation.fallback.bn}
                  </p>
                  <Button to="/contact?type=sponsorship" variant="secondary">
                    {t(copy.donate.cta)}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
