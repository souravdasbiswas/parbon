import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, pick } from './pick.js';

/**
 * v1 ships English as the working language, with Bengali woven in deliberately.
 * A future language switcher only needs to call `setLocale('bn')` — every component
 * already resolves copy through `t()` from this context.
 */
const STORAGE_KEY = 'parbon.locale';

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (field) => pick(field, DEFAULT_LOCALE),
});

function initialLocale() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch {
    /* storage unavailable (private mode) */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback((next) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t: (field) => pick(field, locale) }), [locale, setLocale]);

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = () => useContext(LocaleContext);
