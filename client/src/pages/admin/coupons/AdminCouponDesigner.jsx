import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import CouponArt from '../../../components/coupons/CouponArt.jsx';
import { FIELDS, FONTS, ICONS, SIZE_PRESETS, WEIGHTS, newElementId, sampleFieldData } from '../../../components/coupons/designSpec.js';
import { TemplateGalleryDialog } from '../../../components/coupons/TemplateGallery.jsx';
import { designOrTemplate } from '../../../components/coupons/templates.js';
import Icon from '../../../components/motifs/Icon.jsx';
import Button from '../../../components/ui/Button.jsx';
import Seo from '../../../components/ui/Seo.jsx';
import { ErrorState, LoadingState } from '../../../components/ui/States.jsx';
import { adminApi, adminCouponsApi } from '../../../services/api.js';
import { AdminBar } from '../AdminAnnouncements.jsx';
import { prepareImage, useAdminSession } from '../adminSession.js';
import d from './Designer.module.css';

const HISTORY = 100;
const LOGO = { src: '/brand/logo-480.png', ratio: 1066 / 903 };
const clone = (o) => JSON.parse(JSON.stringify(o));
const isHex6 = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const patchEl = (id, patch) => (dsn) => ({ ...dsn, elements: dsn.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) });

const ELEMENT_LABELS = { text: 'Text', code: 'Coupon code', qr: 'QR code', icon: 'Icon', image: 'Image', shape: 'Shape' };
const describe = (el) => {
  if (el.type === 'text') return el.text?.replace(/\s+/g, ' ').slice(0, 28) || 'Text';
  if (el.type === 'shape') return { rect: 'Rectangle', ellipse: 'Circle / oval', line: 'Line' }[el.shape];
  if (el.type === 'icon') return `Icon · ${el.name}`;
  if (el.type === 'image') return el.src.includes('/brand/') ? 'Parbon logo' : 'Image';
  return ELEMENT_LABELS[el.type];
};

/** Colour input that also accepts "none" (transparent) where it makes sense. */
function ColorField({ label, value, onChange, allowNone }) {
  const none = value === 'transparent';
  return (
    <div className={d.prop}>
      <span className={d.propLabel}>{label}</span>
      <div className={d.colorRow}>
        <input type="color" value={isHex6(value) ? value : '#ffffff'} disabled={none} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input
          type="text"
          className={d.hex}
          value={value || ''}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-label={`${label} (hex)`}
          maxLength={11}
        />
        {allowNone && (
          <label className={d.mini}>
            <input type="checkbox" checked={none} onChange={(e) => onChange(e.target.checked ? 'transparent' : '#ffffff')} /> none
          </label>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className={d.prop}>
      <span className={d.propLabel}>{label}</span>
      <span className={d.numRow}>
        <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        {suffix && <span className={d.suffix}>{suffix}</span>}
      </span>
    </label>
  );
}

function RangeField({ label, value, onChange, min = 0, max = 1, step = 0.05 }) {
  return (
    <label className={d.prop}>
      <span className={d.propLabel}>
        {label} <output>{Math.round((value ?? 1) * 100)}%</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value ?? 1} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className={d.prop}>
      <span className={d.propLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div className={d.prop}>
      <span className={d.propLabel}>{label}</span>
      <div className={d.segmented} role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} className={value === v ? d.segOn : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

async function uploadImageFile(file) {
  const prepared = await prepareImage(file, 2000);
  const saved = await adminApi.uploadImage(prepared.dataUrl);
  return { src: saved.src, width: prepared.width, height: prepared.height };
}

export default function AdminCouponDesigner() {
  const { eventId, typeId } = useParams();
  const session = useAdminSession({ require: true });
  const [event, setEvent] = useState(null);
  const [type, setType] = useState(null);
  const [error, setError] = useState(null);
  const [hist, setHist] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [savedJson, setSavedJson] = useState('');
  const [status, setStatus] = useState({ saving: false, message: '', ok: '' });
  const [showSample, setShowSample] = useState(true);
  const [busyUpload, setBusyUpload] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const lastEdit = useRef({ key: '', t: 0 });
  const artRef = useRef(null);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);
  const uploadTarget = useRef('background');

  useEffect(() => {
    if (session.status !== 'authed') return;
    adminCouponsApi.event(eventId).then((e) => {
      const t = e.types.find((x) => x.id === typeId);
      if (!t) {
        setError(new Error('This coupon type was not found.'));
        return;
      }
      setEvent(e);
      setType(t);
      const initial = clone(designOrTemplate(t));
      setHist({ past: [], present: initial, future: [] });
      setSavedJson(t.design ? JSON.stringify(t.design) : '');
    }, setError);
  }, [session.status, eventId, typeId]);

  const design = hist?.present;
  const dirty = Boolean(design) && JSON.stringify(design) !== savedJson;
  const selected = design?.elements.find((el) => el.id === selectedId) || null;

  // ── History ──
  const commit = useCallback((updater) => {
    lastEdit.current = { key: '', t: 0 };
    setHist((h) => ({ past: [...h.past, h.present].slice(-HISTORY), present: updater(h.present), future: [] }));
  }, []);
  /** Typing in a field: one undo step per burst of edits to the same property. */
  const edit = useCallback((key, updater) => {
    const now = Date.now();
    const same = lastEdit.current.key === key && now - lastEdit.current.t < 1200;
    lastEdit.current = { key, t: now };
    setHist((h) => (same ? { ...h, present: updater(h.present) } : { past: [...h.past, h.present].slice(-HISTORY), present: updater(h.present), future: [] }));
  }, []);
  const undo = useCallback(() => {
    lastEdit.current = { key: '', t: 0 };
    setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] } : h));
  }, []);
  const redo = useCallback(() => {
    lastEdit.current = { key: '', t: 0 };
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  const setProp = (key, value) => selected && edit(`${selected.id}.${key}`, patchEl(selected.id, { [key]: value }));
  const setDesign = (key, value) => edit(`design.${key}`, (dsn) => ({ ...dsn, [key]: value }));

  const addElement = (el) => {
    const W = design.width;
    const H = design.height;
    const full = { id: newElementId(el.type), x: Math.round((W - el.w) / 2), y: Math.round((H - el.h) / 2), rotate: 0, opacity: 1, ...el };
    commit((dsn) => ({ ...dsn, elements: [...dsn.elements, full] }));
    setSelectedId(full.id);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    commit((dsn) => ({ ...dsn, elements: dsn.elements.filter((el) => el.id !== selectedId) }));
    setSelectedId(null);
  }, [selectedId, commit]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy = { ...clone(selected), id: newElementId(selected.type), x: selected.x + 20, y: selected.y + 20, locked: false };
    commit((dsn) => ({ ...dsn, elements: [...dsn.elements, copy] }));
    setSelectedId(copy.id);
  }, [selected, commit]);

  const moveLayer = (dir) => {
    if (!selected) return;
    commit((dsn) => {
      const list = [...dsn.elements];
      const i = list.findIndex((el) => el.id === selected.id);
      const [el] = list.splice(i, 1);
      const to = dir === 'front' ? list.length : dir === 'back' ? 0 : Math.max(0, Math.min(list.length, i + (dir === 'up' ? 1 : -1)));
      list.splice(to, 0, el);
      return { ...dsn, elements: list };
    });
  };

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (selectedId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        edit(`${selectedId}.nudge`, (dsn) => ({
          ...dsn,
          elements: dsn.elements.map((el) => (el.id === selectedId && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
        }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, undo, redo, duplicateSelected, removeSelected, edit]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const sample = useMemo(() => (event && type ? sampleFieldData(event, type) : {}), [event, type]);
  const data = useMemo(
    () => (showSample ? sample : { ...Object.fromEntries(FIELDS.map((f) => [f.key, `{{${f.key}}}`])), code: 'CODE-0000', url: sample.url }),
    [showSample, sample],
  );

  const editor = useMemo(
    () => ({
      selectedId,
      onSelect: setSelectedId,
      onBegin: () => {
        lastEdit.current = { key: '', t: 0 };
        setHist((h) => ({ past: [...h.past, h.present].slice(-HISTORY), present: h.present, future: [] }));
      },
      onChange: (id, patch) => setHist((h) => ({ ...h, present: patchEl(id, patch)(h.present) })),
      onEnd: () => {},
    }),
    [selectedId],
  );

  if (session.status !== 'authed' || (!hist && !error)) {
    return (
      <div className="container section">
        <LoadingState lines={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} />
      </div>
    );
  }

  const save = async () => {
    setStatus({ saving: true, message: '', ok: '' });
    try {
      const saved = await adminCouponsApi.saveDesign(type.id, design);
      setSavedJson(JSON.stringify(saved.design));
      setHist((h) => ({ ...h, present: saved.design }));
      setStatus({ saving: false, message: '', ok: 'Design saved — new and existing coupons of this type now use it.' });
    } catch (err) {
      setStatus({ saving: false, message: err.fields?.design || err.message, ok: '' });
    }
  };

  const exportPng = async () => {
    const { toPng } = await import('html-to-image');
    const url = await toPng(artRef.current, { pixelRatio: 1, width: design.width, height: design.height, style: { transform: 'none' }, cacheBust: true });
    const a = Object.assign(document.createElement('a'), { href: url, download: `${type.name.en.replace(/\W+/g, '-').toLowerCase()}-coupon.png` });
    a.click();
  };

  const onUpload = async (e, target) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyUpload(true);
    try {
      const img = await uploadImageFile(file);
      if (target === 'background') {
        commit((dsn) => ({ ...dsn, background: { ...dsn.background, image: { src: img.src, fit: 'cover', opacity: 1 } } }));
      } else if (target === 'replace' && selected) {
        commit(patchEl(selected.id, { src: img.src }));
      } else {
        const w = Math.min(design.width * 0.4, img.width);
        addElement({ type: 'image', src: img.src, w: Math.round(w), h: Math.round((w * img.height) / img.width), fit: 'contain', radius: 0, blend: 'normal' });
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyUpload(false);
    }
  };

  const bg = design.background;
  const pickPicture = (target) => {
    uploadTarget.current = target;
    bgFileRef.current?.click();
  };

  return (
    <>
      <Seo title={`Design — ${type.name.en}`} noindex />
      <AdminBar session={session} />
      <div className={d.page}>
        <header className={d.top}>
          <div className={d.topTitle}>
            <Link to={`/admin/coupons/${event.id}?tab=types`} className={d.back}>
              ← {event.title.en}
            </Link>
            <h1>
              Design: <span>{type.name.en}</span>
            </h1>
          </div>
          <div className={d.topActions}>
            <button type="button" className={d.tool} onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button type="button" className={d.tool} onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl+Y)">
              ↷ Redo
            </button>
            <label className={d.toggle}>
              <input type="checkbox" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} /> Sample data
            </label>
            <button type="button" className={d.tool} onClick={exportPng}>
              ⤓ PNG
            </button>
            <Button onClick={save} disabled={status.saving || !dirty}>
              {status.saving ? 'Saving…' : dirty ? 'Save design' : 'Saved'}
            </Button>
          </div>
        </header>
        {(status.message || status.ok) && (
          <p className={status.message ? d.error : d.ok} role={status.message ? 'alert' : 'status'}>
            {status.message || status.ok}
          </p>
        )}

        <div className={d.layout}>
          {/* ── Left: add & layers ── */}
          <aside className={d.side} aria-label="Add elements and layers">
            <h2 className={d.h2}>Add</h2>
            <div className={d.addGrid}>
              <button type="button" onClick={() => addElement({ type: 'text', text: 'Your text', w: Math.round(design.width * 0.4), h: 60, font: 'display', size: 40, weight: 600, color: '#231a15', align: 'left' })}>
                <strong>T</strong> Text
              </button>
              <button type="button" onClick={() => addElement({ type: 'qr', w: 220, h: 220, fg: '#231a15', bg: '#ffffff', padding: 12, radius: 12 })}>
                ▦ QR code
              </button>
              <button type="button" onClick={() => addElement({ type: 'code', w: 320, h: 50, font: 'mono', size: 32, weight: 700, letterSpacing: 3, color: '#231a15', align: 'center' })}>
                # Code
              </button>
              <button type="button" onClick={() => addElement({ type: 'image', src: LOGO.src, w: 160, h: Math.round(160 * LOGO.ratio), fit: 'contain', blend: 'multiply' })}>
                ✿ Logo
              </button>
              <button type="button" onClick={() => addElement({ type: 'icon', name: 'lotus', w: 100, h: 100, color: '#a8201a', strokeWidth: 1.5 })}>
                <Icon name="lotus" size={16} /> Icon
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busyUpload}>
                🖼 {busyUpload ? 'Uploading…' : 'Picture'}
              </button>
              <button type="button" onClick={() => addElement({ type: 'shape', shape: 'rect', w: 300, h: 120, fill: '#a8201a', stroke: 'transparent', strokeWidth: 0, radius: 16 })}>
                ▭ Box
              </button>
              <button type="button" onClick={() => addElement({ type: 'shape', shape: 'ellipse', w: 160, h: 160, fill: '#d8bf8a', stroke: 'transparent', strokeWidth: 0 })}>
                ◯ Circle
              </button>
              <button type="button" onClick={() => addElement({ type: 'shape', shape: 'line', w: 300, h: 20, fill: 'transparent', stroke: '#b08a45', strokeWidth: 4 })}>
                ― Line
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onUpload(e, 'add')} />
            <label className={d.prop}>
              <span className={d.propLabel}>Add a field</span>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const f = e.target.value;
                  addElement({ type: 'text', text: `{{${f}}}`, w: Math.round(design.width * 0.4), h: 44, font: 'body', size: 26, weight: 600, color: '#231a15', align: 'left' });
                }}
              >
                <option value="">Choose…</option>
                {FIELDS.filter((f) => f.key !== 'code').map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <h2 className={d.h2}>Layers</h2>
            <p className={d.hint}>Top of the list is in front.</p>
            <ol className={d.layers}>
              {[...design.elements].reverse().map((el) => (
                <li key={el.id}>
                  <button
                    type="button"
                    className={`${d.layer} ${el.id === selectedId ? d.layerOn : ''} ${el.hidden ? d.layerHidden : ''}`}
                    onClick={() => setSelectedId(el.id)}
                  >
                    <span className={d.layerType}>{ELEMENT_LABELS[el.type]}</span>
                    <span className={d.layerName}>{describe(el)}</span>
                    {el.locked && <span title="Locked">🔒</span>}
                    {el.hidden && <span title="Hidden">⦸</span>}
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          {/* ── Centre: canvas ── */}
          <main className={d.stage} aria-label="Coupon canvas">
            <div className={d.canvasWrap} style={{ maxWidth: design.width >= design.height ? '100%' : `${Math.round((design.width / design.height) * 78)}vh` }}>
              <CouponArt design={design} data={data} editor={editor} artRef={artRef} label={`${type.name.en} coupon design`} />
            </div>
            <p className={d.hint}>
              Drag to move · drag the white squares to resize (Shift keeps proportions) · arrow keys nudge · Alt turns snapping off · Delete removes
            </p>
          </main>

          {/* ── Right: properties ── */}
          <aside className={d.side} aria-label="Properties">
            {selected ? (
              <>
                <div className={d.propHead}>
                  <h2 className={d.h2}>{ELEMENT_LABELS[selected.type]}</h2>
                  <button type="button" className={d.link} onClick={() => setSelectedId(null)}>
                    Coupon settings
                  </button>
                </div>

                {selected.type === 'text' && (
                  <>
                    <label className={d.prop}>
                      <span className={d.propLabel}>Text</span>
                      <textarea rows={3} value={selected.text} onChange={(e) => setProp('text', e.target.value)} maxLength={400} />
                    </label>
                    <label className={d.prop}>
                      <span className={d.propLabel}>Insert a field</span>
                      <select value="" onChange={(e) => e.target.value && setProp('text', `${selected.text}{{${e.target.value}}}`)}>
                        <option value="">Choose…</option>
                        {FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {(selected.type === 'text' || selected.type === 'code') && (
                  <>
                    <SelectField label="Font" value={selected.font} onChange={(v) => setProp('font', v)} options={Object.entries(FONTS).map(([k, f]) => [k, f.label])} />
                    <div className={d.pair}>
                      <NumberField label="Size" value={selected.size} min={6} max={600} onChange={(v) => setProp('size', v)} suffix="px" />
                      <SelectField label="Weight" value={String(selected.weight)} onChange={(v) => setProp('weight', Number(v))} options={WEIGHTS.map((w) => [String(w), String(w)])} />
                    </div>
                    <ColorField label="Colour" value={selected.color} onChange={(v) => setProp('color', v)} />
                    <Segmented label="Align" value={selected.align} onChange={(v) => setProp('align', v)} options={[['left', '⟸'], ['center', '≡'], ['right', '⟹']]} />
                    <Segmented label="Vertical" value={selected.valign || 'top'} onChange={(v) => setProp('valign', v)} options={[['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']]} />
                    <div className={d.checks}>
                      <label className={d.mini}>
                        <input type="checkbox" checked={Boolean(selected.italic)} onChange={(e) => setProp('italic', e.target.checked)} /> Italic
                      </label>
                      <label className={d.mini}>
                        <input type="checkbox" checked={Boolean(selected.uppercase)} onChange={(e) => setProp('uppercase', e.target.checked)} /> CAPITALS
                      </label>
                    </div>
                    <div className={d.pair}>
                      <NumberField label="Letter spacing" value={selected.letterSpacing || 0} min={-10} max={60} onChange={(v) => setProp('letterSpacing', v)} />
                      <NumberField label="Line height" value={selected.lineHeight || 1.2} min={0.7} max={3} step={0.05} onChange={(v) => setProp('lineHeight', v)} />
                    </div>
                    <ColorField label="Background" value={selected.background || 'transparent'} onChange={(v) => setProp('background', v)} allowNone />
                    <div className={d.pair}>
                      <NumberField label="Corner radius" value={selected.radius || 0} min={0} max={400} onChange={(v) => setProp('radius', v)} />
                      <NumberField label="Padding" value={selected.padding || 0} min={0} max={200} onChange={(v) => setProp('padding', v)} />
                    </div>
                  </>
                )}

                {selected.type === 'qr' && (
                  <>
                    <p className={d.hint}>Opens the person’s coupon. Keep it large with good contrast so it scans quickly.</p>
                    <ColorField label="Dots" value={selected.fg} onChange={(v) => setProp('fg', v)} />
                    <ColorField label="Background" value={selected.bg} onChange={(v) => setProp('bg', v)} />
                    <div className={d.pair}>
                      <NumberField label="Padding" value={selected.padding} min={0} max={200} onChange={(v) => setProp('padding', v)} />
                      <NumberField label="Corner radius" value={selected.radius} min={0} max={400} onChange={(v) => setProp('radius', v)} />
                    </div>
                  </>
                )}

                {selected.type === 'icon' && (
                  <>
                    <div className={d.prop}>
                      <span className={d.propLabel}>Icon</span>
                      <div className={d.iconGrid}>
                        {ICONS.map((name) => (
                          <button key={name} type="button" title={name} aria-pressed={selected.name === name} className={selected.name === name ? d.iconOn : ''} onClick={() => setProp('name', name)}>
                            <Icon name={name} size={22} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <ColorField label="Colour" value={selected.color} onChange={(v) => setProp('color', v)} />
                    <NumberField label="Line thickness" value={selected.strokeWidth} min={0.5} max={4} step={0.1} onChange={(v) => setProp('strokeWidth', v)} />
                  </>
                )}

                {selected.type === 'image' && (
                  <>
                    <button type="button" className={d.tool} onClick={() => pickPicture('replace')}>
                      Replace picture…
                    </button>
                    <Segmented label="Fit" value={selected.fit} onChange={(v) => setProp('fit', v)} options={[['contain', 'Whole picture'], ['cover', 'Fill box']]} />
                    <SelectField label="Blend" value={selected.blend || 'normal'} onChange={(v) => setProp('blend', v)} options={[['normal', 'Normal'], ['multiply', 'Multiply (drop white)'], ['screen', 'Screen (drop black)']]} />
                    <NumberField label="Corner radius" value={selected.radius || 0} min={0} max={4000} onChange={(v) => setProp('radius', v)} />
                  </>
                )}

                {selected.type === 'shape' && (
                  <>
                    <Segmented label="Shape" value={selected.shape} onChange={(v) => setProp('shape', v)} options={[['rect', 'Box'], ['ellipse', 'Circle'], ['line', 'Line']]} />
                    {selected.shape !== 'line' && <ColorField label="Fill" value={selected.fill} onChange={(v) => setProp('fill', v)} allowNone />}
                    <ColorField label={selected.shape === 'line' ? 'Colour' : 'Outline'} value={selected.stroke} onChange={(v) => setProp('stroke', v)} allowNone />
                    <div className={d.pair}>
                      <NumberField label="Thickness" value={selected.strokeWidth || 0} min={0} max={100} onChange={(v) => setProp('strokeWidth', v)} />
                      {selected.shape === 'rect' && <NumberField label="Corner radius" value={selected.radius || 0} min={0} max={4000} onChange={(v) => setProp('radius', v)} />}
                    </div>
                    <label className={d.mini}>
                      <input type="checkbox" checked={Boolean(selected.dashed)} onChange={(e) => setProp('dashed', e.target.checked)} /> Dashed
                    </label>
                  </>
                )}

                <h3 className={d.h3}>Position</h3>
                <div className={d.quad}>
                  <NumberField label="X" value={selected.x} onChange={(v) => setProp('x', v)} />
                  <NumberField label="Y" value={selected.y} onChange={(v) => setProp('y', v)} />
                  <NumberField label="Width" value={selected.w} min={4} onChange={(v) => (selected.type === 'qr' ? edit(`${selected.id}.size`, patchEl(selected.id, { w: v, h: v })) : setProp('w', v))} />
                  <NumberField label="Height" value={selected.h} min={4} onChange={(v) => (selected.type === 'qr' ? edit(`${selected.id}.size`, patchEl(selected.id, { w: v, h: v })) : setProp('h', v))} />
                </div>
                <div className={d.pair}>
                  <NumberField label="Rotate" value={selected.rotate || 0} min={-180} max={180} onChange={(v) => setProp('rotate', v)} suffix="°" />
                  <RangeField label="Opacity" value={selected.opacity ?? 1} onChange={(v) => setProp('opacity', v)} />
                </div>
                <div className={d.alignRow} role="group" aria-label="Centre on the coupon">
                  <button type="button" className={d.tool} onClick={() => commit(patchEl(selected.id, { x: Math.round((design.width - selected.w) / 2) }))}>
                    ⇔ Centre across
                  </button>
                  <button type="button" className={d.tool} onClick={() => commit(patchEl(selected.id, { y: Math.round((design.height - selected.h) / 2) }))}>
                    ⇕ Centre down
                  </button>
                </div>

                <h3 className={d.h3}>Arrange</h3>
                <div className={d.alignRow}>
                  <button type="button" className={d.tool} onClick={() => moveLayer('front')}>
                    To front
                  </button>
                  <button type="button" className={d.tool} onClick={() => moveLayer('up')}>
                    Forward
                  </button>
                  <button type="button" className={d.tool} onClick={() => moveLayer('down')}>
                    Backward
                  </button>
                  <button type="button" className={d.tool} onClick={() => moveLayer('back')}>
                    To back
                  </button>
                </div>
                <div className={d.checks}>
                  <label className={d.mini}>
                    <input type="checkbox" checked={Boolean(selected.locked)} onChange={(e) => commit(patchEl(selected.id, { locked: e.target.checked }))} /> Lock
                  </label>
                  <label className={d.mini}>
                    <input type="checkbox" checked={Boolean(selected.hidden)} onChange={(e) => commit(patchEl(selected.id, { hidden: e.target.checked }))} /> Hide
                  </label>
                </div>
                <div className={d.alignRow}>
                  <button type="button" className={d.tool} onClick={duplicateSelected}>
                    ⧉ Duplicate
                  </button>
                  <button type="button" className={`${d.tool} ${d.danger}`} onClick={removeSelected}>
                    🗑 Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className={d.h2}>Coupon</h2>
                <button type="button" className={`${d.tool} ${d.bigTool}`} onClick={() => setShowTemplates(true)}>
                  ✦ Browse ready-made designs…
                </button>
                <label className={d.prop}>
                  <span className={d.propLabel}>Size</span>
                  <select
                    value={SIZE_PRESETS.find((p) => p.width === design.width && p.height === design.height)?.id || 'custom'}
                    onChange={(e) => {
                      const p = SIZE_PRESETS.find((x) => x.id === e.target.value);
                      if (p) commit((dsn) => ({ ...dsn, width: p.width, height: p.height }));
                    }}
                  >
                    {SIZE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {p.width}×{p.height}
                      </option>
                    ))}
                    <option value="custom" disabled>
                      Custom
                    </option>
                  </select>
                </label>
                <div className={d.pair}>
                  <NumberField label="Width" value={design.width} min={300} max={2400} onChange={(v) => setDesign('width', v)} />
                  <NumberField label="Height" value={design.height} min={300} max={2400} onChange={(v) => setDesign('height', v)} />
                </div>

                <h3 className={d.h3}>Background</h3>
                <ColorField label="Colour" value={bg.color} onChange={(v) => setDesign('background', { ...bg, color: v })} />
                <label className={d.mini}>
                  <input
                    type="checkbox"
                    checked={Boolean(bg.gradient)}
                    onChange={(e) => commit((dsn) => ({ ...dsn, background: { ...dsn.background, gradient: e.target.checked ? { from: bg.color, to: '#efe2c4', angle: 135 } : null } }))}
                  />{' '}
                  Gradient
                </label>
                {bg.gradient && (
                  <>
                    <ColorField label="From" value={bg.gradient.from} onChange={(v) => setDesign('background', { ...bg, gradient: { ...bg.gradient, from: v } })} />
                    <ColorField label="To" value={bg.gradient.to} onChange={(v) => setDesign('background', { ...bg, gradient: { ...bg.gradient, to: v } })} />
                    <NumberField label="Angle" value={bg.gradient.angle} min={0} max={360} suffix="°" onChange={(v) => setDesign('background', { ...bg, gradient: { ...bg.gradient, angle: v } })} />
                  </>
                )}
                <div className={d.prop}>
                  <span className={d.propLabel}>Background picture</span>
                  <div className={d.alignRow}>
                    <button type="button" className={d.tool} onClick={() => pickPicture('background')} disabled={busyUpload}>
                      {busyUpload ? 'Uploading…' : bg.image ? 'Change…' : 'Upload…'}
                    </button>
                    {bg.image && (
                      <button type="button" className={`${d.tool} ${d.danger}`} onClick={() => commit((dsn) => ({ ...dsn, background: { ...dsn.background, image: null } }))}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {bg.image && (
                  <>
                    <Segmented label="Fit" value={bg.image.fit} onChange={(v) => setDesign('background', { ...bg, image: { ...bg.image, fit: v } })} options={[['cover', 'Fill'], ['contain', 'Whole picture']]} />
                    <RangeField label="Picture strength" value={bg.image.opacity} onChange={(v) => setDesign('background', { ...bg, image: { ...bg.image, opacity: v } })} />
                  </>
                )}

                <h3 className={d.h3}>Frame</h3>
                <div className={d.pair}>
                  <NumberField label="Border" value={design.border.width} min={0} max={60} onChange={(v) => setDesign('border', { ...design.border, width: v })} suffix="px" />
                  <NumberField label="Corner radius" value={design.border.radius} min={0} max={300} onChange={(v) => setDesign('border', { ...design.border, radius: v })} />
                </div>
                <ColorField label="Border colour" value={design.border.color} onChange={(v) => setDesign('border', { ...design.border, color: v })} />
                <p className={d.hint}>Click anything on the coupon to edit it.</p>
              </>
            )}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => onUpload(e, uploadTarget.current)}
            />
          </aside>
        </div>
      </div>
      {showTemplates && (
        <TemplateGalleryDialog
          event={event}
          type={type}
          suggestKind={type.kind}
          onClose={() => setShowTemplates(false)}
          onPick={(t) => {
            if (!dirty || window.confirm(`Replace the current design with “${t.label}”? You can undo this.`)) {
              commit(() => clone(t.design));
              setSelectedId(null);
              setShowTemplates(false);
            }
          }}
        />
      )}
    </>
  );
}
