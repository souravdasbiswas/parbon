import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import Icon from '../motifs/Icon.jsx';
import PronamiPanel from './PronamiPanel.jsx';
import styles from './PronamiDialog.module.css';

const PronamiContext = createContext({ open: () => {} });

/** Provides `usePronami().open()` so any "Offer pronami" button on the site opens the same dialog. */
export function PronamiProvider({ children }) {
  const ref = useRef(null);
  const returnFocus = useRef(null);

  const open = useCallback(() => {
    returnFocus.current = document.activeElement;
    ref.current?.showModal();
  }, []);
  const close = () => ref.current?.close();
  const value = useMemo(() => ({ open }), [open]);

  return (
    <PronamiContext value={value}>
      {children}
      <dialog
        ref={ref}
        className={styles.dialog}
        aria-labelledby="pronami-title"
        onClose={() => returnFocus.current?.focus?.()}
        onClick={(e) => e.target === ref.current && close()}
      >
        <div className={styles.inner}>
          <button type="button" className={styles.close} onClick={close}>
            <Icon name="close" size={20} title="Close" />
          </button>
          <p id="pronami-title" className={styles.eyebrow}>
            <span lang="bn">প্রণামী</span> · Pronami
          </p>
          <PronamiPanel headingLevel="h2" />
        </div>
      </dialog>
    </PronamiContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePronami = () => useContext(PronamiContext);
