import { useEffect, useMemo, useState } from 'react';
import CouponArt from './CouponArt.jsx';
import { sampleFieldData } from './designSpec.js';
import { THEMES, TEMPLATES } from './templates.js';
import styles from './TemplateGallery.module.css';

/**
 * A browsable grid of ready-made coupon designs, filtered by occasion.
 * `event` / `type` fill the previews with real names; `suggest` puts matching templates first.
 */
export default function TemplateGallery({ selectedId, onPick, event, type, suggestTheme, suggestKind, compact = false }) {
  const [theme, setTheme] = useState('all');
  const data = useMemo(() => sampleFieldData(event, type), [event, type]);

  const list = useMemo(() => {
    const score = (t) => (t.theme === suggestTheme ? 2 : 0) + (t.kind === suggestKind ? 1 : 0);
    const shown = theme === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.theme === theme);
    return [...shown].sort((a, b) => score(b) - score(a));
  }, [theme, suggestTheme, suggestKind]);

  return (
    <div className={`${styles.gallery} ${compact ? styles.compact : ''}`}>
      <div className={styles.chips} role="group" aria-label="Filter designs by occasion">
        {[{ id: 'all', label: 'All designs' }, ...THEMES].map((t) => (
          <button key={t.id} type="button" className={`${styles.chip} ${theme === t.id ? styles.chipOn : ''}`} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <ul className={styles.grid} role="list">
        {list.map((t) => {
          // Fit any shape inside the 4:3 thumbnail box.
          const width = Math.min(100, (3 / 4) * (t.design.width / t.design.height) * 100);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`${styles.card} ${selectedId === t.id ? styles.selected : ''}`}
                aria-pressed={selectedId === t.id}
                onClick={() => onPick(t)}
              >
                <span className={styles.thumb}>
                  <span className={styles.art} style={{ width: `${width}%` }}>
                    <CouponArt design={t.design} data={data} label={`${t.label} preview`} />
                  </span>
                </span>
                <span className={styles.label}>{t.label}</span>
                <span className={styles.theme}>{THEMES.find((x) => x.id === t.theme)?.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The gallery in a full-screen dialog (used by the designer). Escape or the backdrop closes it. */
export function TemplateGalleryDialog({ onClose, ...props }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="tpl-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHead}>
          <h2 id="tpl-title">Ready-made designs</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className={styles.hint}>Pick a look to start from — then change any text, colour or picture. Your names and fields fill in automatically.</p>
        <TemplateGallery {...props} />
      </div>
    </div>
  );
}
