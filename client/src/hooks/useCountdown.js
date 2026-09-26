import { useEffect, useState } from 'react';

const parts = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};

/** Live countdown to an ISO timestamp. `done` becomes true once the moment has passed. */
export function useCountdown(targetIso) {
  const target = targetIso ? new Date(targetIso).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(target)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (Number.isNaN(target)) return null;
  const remaining = target - now;
  return { ...parts(remaining), done: remaining <= 0 };
}
