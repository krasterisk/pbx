import { useEffect, useState } from 'react';
import { subscribeStatusClock } from './statusClock';

/**
 * Wall clock that re-renders the caller once a second, driven by the shared status clock
 * (one interval for the whole page, idle when nobody subscribes). Keep it in leaf components so
 * a tick never re-renders the whole cockpit.
 */
export function useNowTick(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    return subscribeStatusClock(() => setNow(Date.now()));
  }, [enabled]);

  return now;
}
