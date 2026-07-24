import type { KpiDisplayMode } from './agentPanelPrefs';

export interface KpiTriple {
  answered: number;
  made: number;
  missed: number;
}

/** Pick shift / day / both value for a single KPI counter. */
export function resolveKpiValue(shift: number, day: number, mode: KpiDisplayMode): string {
  if (mode === 'shift') return String(shift);
  if (mode === 'day') return String(day);
  return `${shift} · ${day}`;
}

export function resolveKpiTriple(
  shift: KpiTriple,
  day: KpiTriple,
  mode: KpiDisplayMode,
): { answered: string; made: string; missed: string; total: string } {
  const answeredShift = shift.answered;
  const madeShift = shift.made;
  const answeredDay = day.answered;
  const madeDay = day.made;
  return {
    answered: resolveKpiValue(answeredShift, answeredDay, mode),
    made: resolveKpiValue(madeShift, madeDay, mode),
    missed: resolveKpiValue(shift.missed, day.missed, mode),
    total: resolveKpiValue(answeredShift + madeShift, answeredDay + madeDay, mode),
  };
}
