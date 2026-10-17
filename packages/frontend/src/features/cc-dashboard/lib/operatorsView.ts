import type { CcDashboardOperators } from '@krasterisk/shared';

export type OperatorsViewState = 'noData' | 'allClear' | 'outliers';

/** `PJSIP/101` is shown as `101`: the channel technology is noise on a dashboard. */
export function operatorLabel(agentInterface: string): string {
  const slash = agentInterface.indexOf('/');
  return slash >= 0 && slash < agentInterface.length - 1 ? agentInterface.slice(slash + 1) : agentInterface;
}

/** `3:05`, `12:00`. */
export function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * No medians means too few operators to compare, which must not read as "everybody is fine".
 */
export function operatorsViewState(operators: CcDashboardOperators): OperatorsViewState {
  if (operators.medianAhtSec === null && operators.medianPauseSharePct === null) return 'noData';
  return operators.outliers.length === 0 ? 'allClear' : 'outliers';
}
