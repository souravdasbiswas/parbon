import { useLayoutEffect, useRef, useState } from 'react';
import Icon from '../motifs/Icon.jsx';
import { FONTS, fillFields } from './designSpec.js';
import QrCode from './QrCode.jsx';
import styles from './CouponArt.module.css';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP_PX = 7;
const MIN = 10;

function textStyle(el) {
  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign || 'top'];
  return {
    fontFamily: (FONTS[el.font] || FONTS.body).css,
    fontSize: el.size,
    fontWeight: el.weight,
    fontStyle: el.italic ? 'italic' : 'normal',
    textTransform: el.uppercase ? 'uppercase' : 'none',
    color: el.color,
    textAlign: el.align || 'left',
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
    lineHeight: el.lineHeight || 1.2,
    background: el.background && el.background !== 'transparent' ? el.background : undefined,
    borderRadius: el.radius || undefined,
    padding: el.padding || undefined,
    justifyContent: justify,
  };
}

function ElementBody({ el, data }) {
  switch (el.type) {
    case 'text':
    case 'code':
      return (
        <div className={styles.text} style={textStyle(el)}>
          <span>{el.type === 'code' ? data.code : fillFields(el.text, data)}</span>
        </div>
      );
    case 'qr':
      return <QrCode value={data.url} fg={el.fg} bg={el.bg} padding={el.padding} radius={el.radius} title={`QR code for coupon ${data.code || ''}`} />;
    case 'icon':
      return (
        <div className={styles.fill} style={{ color: el.color }}>
          <Icon name={el.name} size="100%" strokeWidth={el.strokeWidth || 1.5} />
        </div>
      );
    case 'image':
      return (
        <img
          src={el.src}
          alt=""
          className={styles.fill}
          draggable={false}
          crossOrigin="anonymous"
          style={{ objectFit: el.fit || 'contain', borderRadius: el.radius || 0, mixBlendMode: el.blend || 'normal' }}
        />
      );
    case 'shape':
      if (el.shape === 'line') {
        return (
          <div className={styles.lineWrap}>
            <div style={{ width: '100%', borderTop: `${el.strokeWidth || 2}px ${el.dashed ? 'dashed' : 'solid'} ${el.stroke}` }} />
          </div>
        );
      }
      return (
        <div
          className={styles.fill}
          style={{
            background: el.fill,
            borderRadius: el.shape === 'ellipse' ? '50%' : el.radius || 0,
            border: el.strokeWidth ? `${el.strokeWidth}px ${el.dashed ? 'dashed' : 'solid'} ${el.stroke}` : undefined,
          }}
        />
      );
    default:
      return null;
  }
}

/** Snaps a moving box to the artboard's edges/centre and to other elements; returns offsets and guides. */
function snapBox(box, others, W, H, threshold) {
  const xs = [0, W / 2, W];
  const ys = [0, H / 2, H];
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  const best = (edges, targets) => {
    let pick = null;
    for (const edge of edges) {
      for (const t of targets) {
        const d = t - edge;
        if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.d))) pick = { d, at: t };
      }
    }
    return pick;
  };
  const sx = best([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const sy = best([box.y, box.y + box.h / 2, box.y + box.h], ys);
  return { dx: sx?.d || 0, dy: sy?.d || 0, guides: { x: sx ? [sx.at] : [], y: sy ? [sy.at] : [] } };
}

/**
 * Renders a coupon design at whatever width its container has. With `editor`, elements can be
 * selected, dragged (with snapping — hold Alt to turn it off) and resized.
 * editor = { selectedId, onSelect(id|null), onBegin(), onChange(id, patch), onEnd() }
 */
export default function CouponArt({ design, data, editor, artRef, className = '', label = 'Coupon' }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [guides, setGuides] = useState(null);
  const drag = useRef(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(el.clientWidth / design.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [design.width]);

  const bg = design.background || {};
  const border = design.border || {};
  const artStyle = {
    width: design.width,
    height: design.height,
    transform: `scale(${scale || 0.0001})`,
    backgroundColor: bg.color,
    backgroundImage: bg.gradient ? `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})` : undefined,
    borderRadius: border.radius || 0,
  };

  const startDrag = (event, el, handle) => {
    if (!editor || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    editor.onSelect(el.id);
    if (el.locked) return;
    editor.onBegin?.();
    const start = { x: event.clientX, y: event.clientY, box: { x: el.x, y: el.y, w: el.w, h: el.h } };
    const others = design.elements.filter((o) => o.id !== el.id && !o.hidden && !o.rotate);
    drag.current = { handle, start, el, others };

    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.start.x) / scale;
      const dy = (e.clientY - d.start.y) / scale;
      const b = { ...d.start.box };
      if (d.handle === 'move') {
        b.x += dx;
        b.y += dy;
        if (!e.altKey) {
          const snap = snapBox(b, d.others, design.width, design.height, SNAP_PX / scale);
          b.x += snap.dx;
          b.y += snap.dy;
          setGuides(snap.guides);
        } else setGuides(null);
      } else {
        if (d.handle.includes('e')) b.w = Math.max(MIN, d.start.box.w + dx);
        if (d.handle.includes('s')) b.h = Math.max(MIN, d.start.box.h + dy);
        if (d.handle.includes('w')) {
          b.w = Math.max(MIN, d.start.box.w - dx);
          b.x = d.start.box.x + d.start.box.w - b.w;
        }
        if (d.handle.includes('n')) {
          b.h = Math.max(MIN, d.start.box.h - dy);
          b.y = d.start.box.y + d.start.box.h - b.h;
        }
        // QR codes stay square; Shift keeps the proportions of anything else.
        if (d.el.type === 'qr' || e.shiftKey) {
          const ratio = d.start.box.w / d.start.box.h;
          if (d.handle === 'n' || d.handle === 's') b.w = b.h * ratio;
          else b.h = b.w / ratio;
          if (d.handle.includes('n')) b.y = d.start.box.y + d.start.box.h - b.h;
        }
      }
      const round = (n) => Math.round(n);
      editor.onChange(d.el.id, { x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) });
    };
    const up = () => {
      drag.current = null;
      setGuides(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      editor.onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${editor ? styles.editing : ''} ${className}`}
      style={{ aspectRatio: `${design.width} / ${design.height}`, borderRadius: (border.radius || 0) * (scale || 1) }}
      role="img"
      aria-label={label}
    >
      <div
        ref={artRef}
        className={styles.art}
        style={artStyle}
        onPointerDown={editor ? (e) => e.target === e.currentTarget && editor.onSelect(null) : undefined}
      >
        {bg.image?.src && (
          <img
            src={bg.image.src}
            alt=""
            className={styles.bgImage}
            crossOrigin="anonymous"
            draggable={false}
            style={{ objectFit: bg.image.fit || 'cover', opacity: bg.image.opacity ?? 1 }}
          />
        )}
        {design.elements.map((el) => {
          if (el.hidden && !editor) return null;
          const selected = editor?.selectedId === el.id;
          return (
            <div
              key={el.id}
              className={`${styles.el} ${selected ? styles.selected : ''} ${el.locked ? styles.locked : ''}`}
              style={{
                left: el.x,
                top: el.y,
                width: el.w,
                height: el.h,
                transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
                opacity: el.hidden ? 0.2 : el.opacity ?? 1,
                '--handle': `${12 / (scale || 1)}px`,
                '--outline': `${Math.max(1, 2 / (scale || 1))}px`,
              }}
              onPointerDown={editor ? (e) => startDrag(e, el, 'move') : undefined}
            >
              <ElementBody el={el} data={data} />
              {selected && !el.locked && (
                <>
                  {HANDLES.map((h) => (
                    <span key={h} className={`${styles.handle} ${styles[`h_${h}`]}`} onPointerDown={(e) => startDrag(e, el, h)} />
                  ))}
                </>
              )}
            </div>
          );
        })}
        {border.width > 0 && (
          <div className={styles.border} style={{ borderRadius: border.radius || 0, boxShadow: `inset 0 0 0 ${border.width}px ${border.color}` }} />
        )}
        {guides?.x.map((x) => <span key={`x${x}`} className={styles.guideV} style={{ left: x, '--outline': `${Math.max(1, 1 / (scale || 1))}px` }} />)}
        {guides?.y.map((y) => <span key={`y${y}`} className={styles.guideH} style={{ top: y, '--outline': `${Math.max(1, 1 / (scale || 1))}px` }} />)}
      </div>
    </div>
  );
}
