/** Which way a KPI should move: more SLA is good, more abandons or longer waits are bad. */
export type KpiDirection = 'higherIsBetter' | 'lowerIsBetter' | 'neutral';

export interface KpiDelta {
  /** `current - previous`, rounded to one decimal. */
  abs: number;
  /** Relative change in percent; `null` when the previous value is 0 (no meaningful base). */
  pct: number | null;
  trend: 'up' | 'down' | 'flat';
  /** Colour meaning of the change; `default` when flat or when the KPI has no "good" direction. */
  tone: 'success' | 'destructive' | 'default';
}

/** `+5`, `-3`, `0` - explicit sign for a change. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Change versus the previous period. Returns `null` when there is nothing to compare with,
 * which the UI shows as "no comparison" - never as a change from zero.
 */
export function kpiDelta(
  current: number,
  previous: number | null | undefined,
  direction: KpiDirection,
): KpiDelta | null {
  if (
    previous === null
    || previous === undefined
    || !Number.isFinite(previous)
    || !Number.isFinite(current)
    || previous === 0
  ) {
    return null;
  }
  const abs = round1(current - previous);
  const trend: KpiDelta['trend'] = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  const pct = round1(((current - previous) / Math.abs(previous)) * 100);

  let tone: KpiDelta['tone'] = 'default';
  if (trend !== 'flat' && direction !== 'neutral') {
    const improved = direction === 'higherIsBetter' ? trend === 'up' : trend === 'down';
    tone = improved ? 'success' : 'destructive';
  }
  return { abs, pct, trend, tone };
}
