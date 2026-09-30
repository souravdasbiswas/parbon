import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../components/motifs/Icon.jsx';
import { useT } from './BiTitle.jsx';
import { sheetCopy } from './copy.js';
import styles from './BottomSheet.module.css';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Responsive modal surface.
 * Props: open, onClose(reason), title?, header?, children, footer?, closeLabel?, historyKey?, className?, contentClassName?.
 * Mobile renders as a swipe-down bottom sheet; desktop renders as a centred dialog.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  header,
  children,
  footer,
  closeLabel,
  historyKey = 'sheet',
  className = '',
  contentClassName = '',
}) {
  const id = useId().replace(/:/g, '');
  const panelRef = useRef(null);
  const pushedRef = useRef(false);
  const tokenRef = useRef('');
  const startY = useRef(null);
  const lastActive = useRef(null);
  const { t } = useT();
  const [drag, setDrag] = useState(0);
  const resolvedCloseLabel = closeLabel || t(sheetCopy.close);

  const requestClose = (source) => {
    if (pushedRef.current && window.history.state?.parbonSheet === tokenRef.current) {
      window.history.back();
      return;
    }
    pushedRef.current = false;
    onClose?.({ source });
  };

  useEffect(() => {
    if (!open) return undefined;
    lastActive.current = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      lastActive.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const focusables = () => [...(panel?.querySelectorAll(FOCUSABLE) || [])].filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
    window.setTimeout(() => (focusables()[0] || panel)?.focus({ preventScroll: true }), 0);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose('escape');
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // requestClose intentionally reads refs updated outside this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (!pushedRef.current) {
      tokenRef.current = `${historyKey}-${Date.now()}`;
      window.history.pushState({ ...(window.history.state || {}), parbonSheet: tokenRef.current }, '', window.location.href);
      pushedRef.current = true;
    }
    const onPopState = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      onClose?.({ source: 'history' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [historyKey, onClose, open]);

  if (!open) return null;

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse') return;
    startY.current = event.clientY;
  };
  const onPointerMove = (event) => {
    if (startY.current == null) return;
    setDrag(Math.max(0, event.clientY - startY.current));
  };
  const onPointerUp = () => {
    if (drag > 80) requestClose('swipe');
    startY.current = null;
    setDrag(0);
  };

  return (
    <div className={styles.portal} role="presentation">
      <button type="button" className={styles.backdrop} aria-label={resolvedCloseLabel} onClick={() => requestClose('backdrop')} />
      <section
        ref={panelRef}
        className={`${styles.panel} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        tabIndex={-1}
        style={drag ? { '--sheet-drag': `${drag}px` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.grab} aria-hidden="true" />
        <div className={styles.top}>
          <div className={styles.header}>
            {title && (
              <h2 id={`${id}-title`} className={styles.title}>
                {title}
              </h2>
            )}
            {header}
          </div>
          <button type="button" className={styles.close} onClick={() => requestClose('close')} aria-label={resolvedCloseLabel}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={`${styles.content} ${contentClassName}`}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </section>
    </div>
  );
}
