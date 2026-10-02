import { useEffect, useRef, useState } from 'react';
import Icon from '../components/motifs/Icon.jsx';
import Button from '../components/ui/Button.jsx';
import PageHero from '../components/ui/PageHero.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
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

const pad = (n) => String(n).padStart(2, '0');
const isWide = (item) => item.width > 0 && item.height > 0 && item.width / item.height > 1.15;
// How far (px) a swipe must travel before it changes the photo.
const SWIPE_THRESHOLD = 60;

/** Full-screen slideshow: swipe, arrow keys, buttons or the thumbnail strip move between photos. */
function Slideshow({ items, index, title, onClose, onStep, onJump }) {
  const ref = useRef(null);
  const thumbsRef = useRef(null);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState(0);
  const { t } = useLocale();
  const item = items[index];

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === 'Home') onJump(0);
      else if (e.key === 'End') onJump(items.length - 1);
      else return;
      e.preventDefault();
    };
    dialog.addEventListener('keydown', onKey);
    return () => dialog.removeEventListener('keydown', onKey);
  }, [items.length, onJump, onStep]);

  useEffect(() => {
    const active = thumbsRef.current?.querySelector('[aria-current="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false };
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    if (!g.dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
      g.dragging = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the swipe still works without capture.
      }
    }
    setDrag(dx);
  };
  const onPointerEnd = (e) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.dragging) return;
    const dx = e.clientX - g.x;
    suppressClick.current = true;
    setDrag(0);
    if (dx <= -SWIPE_THRESHOLD) onStep(1);
    else if (dx >= SWIPE_THRESHOLD) onStep(-1);
  };
  // A click on the dark area around the photo closes the slideshow (but not the end of a swipe).
  const onSlideClick = (e) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (e.target === e.currentTarget) ref.current.close();
  };

  const near = (i) => {
    const d = Math.abs(i - index);
    return d <= 1 || d === items.length - 1;
  };

  if (!item) return null;
  return (
    <dialog ref={ref} className={styles.slideshow} aria-label={`${title} — photo slideshow`} onClose={onClose}>
      <div className={styles.bar}>
        <p className={styles.counter} aria-hidden="true">
          <span>{pad(index + 1)}</span> / {pad(items.length)}
        </p>
        <p className={styles.barTitle}>{title}</p>
        <button type="button" className={styles.round} onClick={() => ref.current.close()}>
          <Icon name="close" size={22} title="Close slideshow" />
        </button>
      </div>

      <div className={styles.stage}>
        <div
          className={styles.viewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <ul
            className={`${styles.track} ${drag ? styles.dragging : ''}`}
            style={{ transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)` }}
            role="list"
          >
            {items.map((it, i) => (
              <li
                key={it.id || it.src}
                className={styles.slide}
                aria-hidden={i !== index}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${items.length}`}
                onClick={onSlideClick}
              >
                {near(i) && <img src={it.src} alt={t(it.alt)} width={it.width} height={it.height} draggable={false} decoding="async" />}
              </li>
            ))}
          </ul>
        </div>
        {items.length > 1 && (
          <>
            <button type="button" className={`${styles.round} ${styles.prev}`} onClick={() => onStep(-1)}>
              <Icon name="arrow" size={22} title="Previous photo" />
            </button>
            <button type="button" className={`${styles.round} ${styles.next}`} onClick={() => onStep(1)}>
              <Icon name="arrow" size={22} title="Next photo" />
            </button>
          </>
        )}
      </div>

      <div className={styles.captionBar} aria-live="polite">
        <p className="visually-hidden">
          Photo {index + 1} of {items.length}
        </p>
        {item.caption && (
          <p className={styles.slideCaption}>
            {item.caption.bn && (
              <span lang="bn" className={styles.slideCaptionBn}>
                {item.caption.bn}
              </span>
            )}
            <span>{t(item.caption)}</span>
          </p>
        )}
      </div>

      {items.length > 1 && (
        <ul ref={thumbsRef} className={styles.thumbs} role="list" aria-label="All photos">
          {items.map((it, i) => (
            <li key={it.id || it.src}>
              <button type="button" className={styles.thumbBtn} aria-current={i === index} onClick={() => onJump(i)}>
                <img src={it.thumb || it.src} alt="" loading="lazy" decoding="async" draggable={false} />
                <span className="visually-hidden">
                  Show photo {i + 1}
                  {it.caption ? `: ${t(it.caption)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
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
  const current = albums.find((a) => a.id === album);
  const step = (n) => setOpen((i) => (i + n + items.length) % items.length);

  return (
    <>
      <Seo title="Gallery" description="Moments captured from Parbon Sanskritik Samity's past events — Durga Puja, Sindoor Khela, Boron and more." />
      <PageHero eyebrow={copy.hero.eyebrow} title={copy.hero.title} intro={data?.intro} />

      <section className="section" aria-labelledby="album-title">
        <div className="container">
          {loading && <LoadingState lines={3} />}
          {error && <ErrorState error={error} onRetry={retry} />}

          {data && data.items.length > 0 && (
            <>
              <SectionHeading id="album-title" eyebrow={copy.album.eyebrow} title={copy.album.title} intro={copy.album.hint} divider />
              <div className={styles.toolbar}>
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
                {items.length > 1 && (
                  <Button variant="secondary" size="sm" className={styles.slideshowBtn} onClick={() => setOpen(0)} arrow>
                    {t(copy.album.slideshow)}
                  </Button>
                )}
              </div>

              <ul className={styles.grid} role="list">
                {items.map((item, i) => (
                  <li key={item.id || item.src} className={`${styles.cell} ${isWide(item) ? styles.wide : ''} reveal`} style={{ '--i': i }}>
                    <button type="button" className={styles.tile} onClick={() => setOpen(i)}>
                      <img
                        src={item.thumb || item.src}
                        alt={t(item.alt)}
                        width={item.width}
                        height={item.height}
                        loading={i < 3 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                      <span className={styles.shade} aria-hidden="true" />
                      <span className={styles.num} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      {item.caption && (
                        <span className={styles.caption}>
                          {item.caption.bn && (
                            <span lang="bn" className={styles.captionBn}>
                              {item.caption.bn}
                            </span>
                          )}
                          <span className={styles.captionEn}>{t(item.caption)}</span>
                        </span>
                      )}
                      <span className="visually-hidden">— open in slideshow</span>
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

      {open !== null && (
        <Slideshow
          items={items}
          index={open}
          title={t(current?.title || copy.album.title)}
          onClose={() => setOpen(null)}
          onStep={step}
          onJump={setOpen}
        />
      )}
    </>
  );
}
