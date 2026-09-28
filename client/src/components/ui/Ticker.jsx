import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../motifs/Icon.jsx';
import styles from './Ticker.module.css';

// Pixels per second, so the reading pace is the same however much text there is.
const SPEED = { wide: 55, narrow: 45 };
const RESUME_AFTER_TOUCH_MS = 3000;

function Part({ part }) {
  const cls = `${styles.part} ${styles[part.kind] || ''}`;
  const content = (
    <>
      {part.kind === 'place' && <Icon name="pin" size={16} className={styles.pin} />}
      <span>{part.text}</span>
      {part.sub && <span className={styles.sub}>{part.sub}</span>}
      {part.href && (
        <span aria-hidden="true" className={styles.ext}>
          ↗
        </span>
      )}
    </>
  );
  if (part.to) {
    return (
      <Link to={part.to} className={`${cls} ${styles.link}`} aria-label={part.ariaLabel}>
        {content}
      </Link>
    );
  }
  if (part.href) {
    return (
      <a href={part.href} target="_blank" rel="noopener noreferrer" className={`${cls} ${styles.link}`} aria-label={part.ariaLabel}>
        {content}
      </a>
    );
  }
  return <span className={cls}>{content}</span>;
}

function Group({ items, hidden, groupRef, minWidth }) {
  return (
    <ul
      ref={groupRef}
      className={styles.group}
      style={minWidth ? { minWidth } : undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      role="list"
    >
      {items.map((item) => (
        <li key={item.key} className={styles.item}>
          {item.icon && (
            <span className={styles.itemIcon} aria-hidden="true">
              <Icon name={item.icon} size={17} />
            </span>
          )}
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
          {item.parts.map((part, i) => (
            <Part key={i} part={part} />
          ))}
          <Icon name="lotus" size={18} className={styles.sep} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A scrolling "running text" band. `items` are `{ key, icon?, badge?, parts: [{ text, sub?, kind?, to? | href?, ariaLabel? }] }`:
 * `to` is an in-site route, `href` an external link (opens in a new tab).
 * The list is rendered twice for a seamless loop; the copy is hidden from screen readers and keyboard focus.
 */
export default function Ticker({ items, label, allTo, allLabel, ariaLabel = 'Latest updates' }) {
  const viewportRef = useRef(null);
  const groupRef = useRef(null);
  const resumeTimer = useRef(null);
  const [size, setSize] = useState({ viewport: 0, duration: 0 });
  const [touchPaused, setTouchPaused] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const group = groupRef.current;
    if (!viewport || !group) return;
    const update = () => {
      const speed = window.innerWidth < 560 ? SPEED.narrow : SPEED.wide;
      setSize({ viewport: viewport.clientWidth, duration: group.offsetWidth / speed });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(group);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  if (!items.length) return null;

  const onTouchStart = () => {
    clearTimeout(resumeTimer.current);
    setTouchPaused(true);
  };
  const onTouchEnd = () => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setTouchPaused(false), RESUME_AFTER_TOUCH_MS);
  };

  const onBlur = (e) => {
    // Focusing a link scrolls the clipped viewport to reveal it; undo that once focus leaves so the loop stays seamless.
    const viewport = e.currentTarget;
    if (viewport.contains(e.relatedTarget) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    viewport.scrollLeft = 0;
  };

  const running = size.duration > 0;
  // Each copy is at least as wide as the viewport, so short lists still loop without a visible gap jump.
  const minWidth = size.viewport ? `${size.viewport}px` : undefined;

  return (
    <section className={styles.ticker} aria-label={ariaLabel}>
      <p className={styles.label}>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="megaphone" size={18} />
        </span>
        <span className={styles.labelText}>
          <span lang="bn" className={styles.labelBn}>
            {label.bn}
          </span>
          <span className={styles.labelEn}>{label.en}</span>
        </span>
      </p>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onBlur={onBlur}
      >
        <div
          className={`${styles.track} ${running ? styles.running : ''} ${touchPaused ? styles.paused : ''}`}
          style={running ? { '--ticker-duration': `${size.duration.toFixed(2)}s` } : undefined}
        >
          <Group items={items} groupRef={groupRef} minWidth={minWidth} />
          <Group items={items} hidden minWidth={minWidth} />
        </div>
      </div>

      <Link to={allTo} className={styles.all} aria-label={allLabel}>
        <span className={styles.allText}>{allLabel}</span>
        <Icon name="arrow" size={18} />
      </Link>
    </section>
  );
}
