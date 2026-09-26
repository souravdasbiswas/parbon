import { useCallback, useEffect, useState } from 'react';

// Session-level cache so navigating between pages doesn't refetch unchanged content;
// `inflight` de-duplicates concurrent requests for the same key (e.g. header + footer).
const cache = new Map();
const inflight = new Map();

const EMPTY = { key: null, data: undefined, error: null };

/** Drops cached responses whose key starts with `prefix` (e.g. after an admin edit). */
export function invalidateApi(prefix) {
  for (const key of cache.keys()) if (String(key).startsWith(prefix)) cache.delete(key);
}

/**
 * Loads data from an async loader identified by `key`.
 * Returns { data, error, loading, retry }.
 */
export function useApi(key, loader) {
  const [result, setResult] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key == null || cache.has(key)) return undefined;
    let active = true;
    if (!inflight.has(key)) inflight.set(key, loader().finally(() => inflight.delete(key)));
    inflight.get(key).then(
      (data) => {
        cache.set(key, data);
        if (active) setResult({ key, data, error: null });
      },
      (error) => {
        if (active && error.name !== 'AbortError') setResult({ key, data: undefined, error });
      },
    );
    return () => {
      active = false;
    };
    // `loader` is intentionally excluded: callers pass inline functions, `key` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => {
    cache.delete(key);
    setResult(EMPTY);
    setAttempt((n) => n + 1);
  }, [key]);

  if (cache.has(key)) return { data: cache.get(key), error: null, loading: false, retry };
  const current = result.key === key ? result : EMPTY;
  return { data: current.data, error: current.error, loading: !current.error && current.data === undefined, retry };
}
