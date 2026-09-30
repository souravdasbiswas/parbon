import { useParams } from 'react-router';
import Button from '../../components/ui/Button.jsx';
import SectionHeading from '../../components/ui/SectionHeading.jsx';
import Seo from '../../components/ui/Seo.jsx';
import styles from './V2ComingSoon.module.css';

const copy = {
  give: {
    title: 'Giving is being refreshed',
    intro: 'The new donation journey is being prepared for the v2 experience. You can still support Parbon from the current get involved page.',
    cta: 'Donate from get involved',
    to: '/get-involved#donate',
  },
  passes: {
    title: 'Passes are coming soon',
    intro: 'The v2 passes flow will live here. For now, the existing registration page remains the safest way to request coupons.',
    cta: 'Open registration',
    to: '/register',
  },
  sponsor: {
    title: 'Sponsor experience is coming soon',
    intro: 'The v2 sponsor journey will launch here. Until then, please use the current sponsorship and event pages.',
    cta: 'View sponsorship options',
    to: '/get-involved',
  },
};

export default function V2ComingSoon({ kind }) {
  const { slug } = useParams();
  const item = copy[kind] || copy.sponsor;
  const to = kind === 'sponsor' && slug ? `/events/${slug}` : item.to;

  return (
    <>
      <Seo title={item.title} description={item.intro} />
      <section className={`section section--paper ${styles.wrap}`}>
        <div className="container-narrow">
          <SectionHeading
            eyebrow={{ en: 'V2 preview', bn: 'নতুন অভিজ্ঞতা' }}
            title={{ en: item.title, bn: 'শীঘ্রই আসছে' }}
            intro={{ en: item.intro, bn: item.intro }}
            as="h1"
            divider
          />
          <div className={styles.actions}>
            <Button to={to} size="lg" arrow>
              {slug ? 'Open related event' : item.cta}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
