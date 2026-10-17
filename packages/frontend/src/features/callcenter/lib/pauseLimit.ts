/** Seconds before the limit at which the operator is warned (U2.7). */
export const PAUSE_WARN_SEC = 60;

export type PauseLimitLevel = 'none' | 'ok' | 'warn' | 'over';

export interface PauseLimitState {
  level: PauseLimitLevel;
  limitSec: number;
  /** Seconds left until the limit (0 once exceeded). */
  remainingSec: number;
  /** Seconds past the limit (0 until exceeded). */
  overSec: number;
}

/**
 * State of a pause against the reason's `max_duration` (minutes; 0 / undefined = unlimited).
 * `warn` starts one minute before the limit, `over` once the limit is exceeded.
 */
export function pauseLimitState(elapsedSec: number, maxDurationMin: number | undefined | null): PauseLimitState {
  const limitSec = Math.max(0, Math.round((maxDurationMin ?? 0) * 60));
  if (limitSec <= 0) return { level: 'none', limitSec: 0, remainingSec: 0, overSec: 0 };
  const elapsed = Math.max(0, Math.floor(elapsedSec));
  if (elapsed > limitSec) {
    return { level: 'over', limitSec, remainingSec: 0, overSec: elapsed - limitSec };
  }
  const remainingSec = limitSec - elapsed;
  return {
    level: remainingSec <= PAUSE_WARN_SEC ? 'warn' : 'ok',
    limitSec,
    remainingSec,
    overSec: 0,
  };
}
