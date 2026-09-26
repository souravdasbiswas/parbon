import { useEffect, useRef, useState } from 'react';
import Icon from '../components/motifs/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import Seo from '../components/ui/Seo.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { gallery as copy } from '../content/pages.js';
import { useApi } from '../hooks/useApi.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { contentApi } from '../services/api.js';
import styles from './Gallery.module.css';

const PLACEHOLDER_FRAMES = [
  { icon: 'dhak', bn: 'ঢাকের বোল', en: 'The dhak' },
  { icon: 'alpana', bn: 'আলপনা', en: 'Alpana' },
  { icon: 'lamp', bn: 'সন্ধ্যারতি', en: 'Sandhya arati' },
  { icon: 'bhog', bn: 'ভোগ', en: 'Bhog' },
  { icon: 'shankha', bn: 'শঙ্খধ্বনি', en: 'The shankha' },
  { icon: 'sindoor', bn: 'সিঁদুর খেলা', en: 'Sindoor khela' },
];

function Lightbox({ items, index, onClose, onNavigate }) {
  const ref = useRef(null);
  const { t } = useLocale();
  const item = items[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    const onKey = (e) => {
      if (e.key === 'ArrowRight') onNavigate(1);
      if (e.key === 'ArrowLeft') onNavigate(-1);
    };
    dialog.addEventListener('keydown', onKey);
    return () => dialog.removeEventListener('keydown', onKey);
  }, [onNavigate]);

  if (!item) return null;
  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label={t(item.alt) || 'Photo'}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
    >
      <figure className={styles.lightboxFigure}>
        <img src={item.src} alt={t(item.alt)} width={item.width} height={item.height} />
        {item.caption && (
          <figcaption>
            {t(item.caption)}
            {item.caption.bn && <span lang="bn"> · {item.caption.bn}</span>}
          </figcaption>
        )}
      </figure>
      <button type="button" className={`${styles.lbBtn} ${styles.lbClose}`} onClick={() => ref.current.close()}>
        <Icon name="close" size={22} title="Close" />
      </button>
      {items.length > 1 && (
        <>
          <button type="button" className={`${styles.lbBtn} ${styles.lbPrev}`} onClick={() => onNavigate(-1)}>
            <Icon name="arrow" size={22} title="Previous photo" />
          </button>
          <button type="button" className={`${styles.lbBtn} ${styles.lbNext}`} onClick={() => onNavigate(1)}>
            <Icon name="arrow" size={22} title="Next photo" />
          </button>
        </>
      )}
    </dialog>
  );
}

export default function Gallery() {
  const { t } = useLocale();
  const { data, loading, error, retry } = useApi('gallery', contentApi.gallery);
  const [album, setAlbum] = useState('all');
  const [open, setOpen] = useState(null);

  const items = (data?.items || []).filter((i) => album === 'all' || i.album === album);
  const albums = data?.albums || [];
  const navigate = (step) => setOpen((i) => (i + step + items.length) % items.length);

  return (
    <>
      <Seo title="Gallery" description="Moments and memories from Parbon Sanskritik Samity's celebrations — Durga Puja and more." />
      <PageHero eyebrow={copy.hero.eyebrow} title={copy.hero.title} intro={data?.intro} />

      <section className="section" aria-label="Photo gallery">
        <div className="container">
          {loading && <LoadingState lines={3} />}
          {error && <ErrorState error={error} onRetry={retry} />}

          {data && data.items.length > 0 && (
            <>
              {albums.length > 1 && (
                <div className={styles.filters} role="group" aria-label="Filter by album">
                  {[{ id: 'all', title: copy.all }, ...albums].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.filter}
                      aria-pressed={album === a.id}
                      onClick={() => setAlbum(a.id)}
                    >
                      {t(a.title)}
                    </button>
                  ))}
                </div>
              )}
              <ul className={styles.grid} role="list">
                {items.map((item, i) => (
                  <li key={item.id || item.src} className="reveal">
                    <button type="button" className={styles.thumb} onClick={() => setOpen(i)}>
                      <img
                        src={item.thumb || item.src}
                        alt={t(item.alt)}
                        width={item.width}
                        height={item.height}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data && data.items.length === 0 && (
            <div className={styles.emptyWrap}>
              <ul className={styles.frames} role="list" aria-label="Moments we look forward to capturing">
                {PLACEHOLDER_FRAMES.map((f) => (
                  <li key={f.icon} className={`${styles.frame} reveal`}>
                    <Icon name={f.icon} size={40} strokeWidth={1.2} />
                    <span lang="bn" className={styles.frameBn}>
                      {f.bn}
                    </span>
                    <span className={styles.frameEn}>{f.en}</span>
                  </li>
                ))}
              </ul>
              <EmptyState title={copy.empty.title} text={copy.empty.text}>
                <Button to="/contact?type=general" variant="secondary" size="sm">
                  {t(copy.empty.cta)}
                </Button>
              </EmptyState>
            </div>
          )}
        </div>
      </section>

      {open !== null && <Lightbox items={items} index={open} onClose={() => setOpen(null)} onNavigate={navigate} />}
    </>
  );
}
