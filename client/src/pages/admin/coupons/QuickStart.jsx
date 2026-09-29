import CouponArt from '../../../components/coupons/CouponArt.jsx';
import { rupees } from '../../../components/coupons/couponUtils.js';
import { sampleFieldData } from '../../../components/coupons/designSpec.js';
import { EVENT_PRESETS } from '../../../components/coupons/eventPresets.js';
import { templateById } from '../../../components/coupons/templates.js';
import Icon from '../../../components/motifs/Icon.jsx';
import styles from '../Admin.module.css';
import q from './QuickStart.module.css';

/** Step 1 of a new event: pick a ready-made event (or start blank). */
export function PresetPicker({ onPick }) {
  return (
    <div className={q.wrap}>
      <h2 className={q.h2}>Start from a ready-made event</h2>
      <p className="muted">Everything is filled in — the coupon types come already designed. Change anything you like.</p>
      <ul className={q.grid} role="list">
        {EVENT_PRESETS.map((p) => {
          const first = templateById(p.types[0].template);
          const width = Math.min(100, (9 / 16) * (first.design.width / first.design.height) * 100);
          return (
            <li key={p.id}>
              <button type="button" className={q.card} onClick={() => onPick(p)}>
                <span className={q.preview} aria-hidden="true">
                  <span className={q.previewArt} style={{ width: `${width}%` }}>
                    <CouponArt design={first.design} data={sampleFieldData({ title: p.event.title, startsAt: p.event.startsAt, endsAt: p.event.endsAt, venue: { name: 'Your venue' } }, p.types[0])} />
                  </span>
                </span>
                <span className={q.title}>
                  <Icon name={p.icon} size={20} /> {p.label} <span lang="bn">{p.bn}</span>
                </span>
                <span className={q.blurb}>{p.blurb}</span>
                <span className={q.types}>{p.types.map((t) => t.name.en).join(' · ')}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className={`${q.card} ${q.blank}`} onClick={() => onPick(null)}>
            <span className={q.blankIcon} aria-hidden="true">
              +
            </span>
            <span className={q.title}>Start from scratch</span>
            <span className={q.blurb}>An empty event — add coupon types yourself.</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

/** The coupon types a preset will create, with a tick and a price for each. */
export function PresetTypes({ preset, event, value, onChange }) {
  const set = (i, patch) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <fieldset className={styles.group}>
      <legend>Coupon types to create</legend>
      <p className={styles.hint}>Each comes with a ready design. You can change designs, prices and limits later in “Coupon types & designs”.</p>
      <ul className={q.typeList} role="list">
        {value.map((t, i) => {
          const tpl = templateById(t.template);
          const tall = tpl.design.height > tpl.design.width;
          return (
            <li key={`${preset.id}-${i}`} className={`${q.typeRow} ${t.enabled ? '' : q.off}`}>
              <label className={q.typeCheck}>
                <input type="checkbox" checked={t.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} />
                <span>
                  <strong>{t.name.en}</strong> <span lang="bn">{t.name.bn}</span>
                  <small>{tpl.label}</small>
                </span>
              </label>
              <span className={q.typeThumb} style={{ width: tall ? 60 : 140 }}>
                <CouponArt design={tpl.design} data={sampleFieldData(event, t)} label={`${t.name.en} design`} />
              </span>
              <label className={q.price}>
                ₹
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={t.price}
                  aria-label={`Price for ${t.name.en}`}
                  onChange={(e) => set(i, { price: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                />
                <span className={q.priceText}>{Number(t.price) ? rupees(t.price) : 'Free'}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
