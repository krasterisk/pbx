import type { CcDashboardPauses } from '@krasterisk/shared';
import { kpiDelta, type KpiDelta } from './kpiDelta';

/** Reasons beyond this many are folded into one "other" row so the list stays readable. */
export const MAX_PAUSE_ROWS = 6;

export interface PauseRowView {
  /** Reason name; empty for the folded "other" row (the UI supplies the label). */
  reason: string;
  isOther: boolean;
  count: number;
  totalSec: number;
  /** Share of all pause time, 0-100, one decimal. */
  pct: number;
  isPaid: boolean | null;
}

export interface PausesView {
  totalSec: number;
  count: number;
  /** Change of the total pause time versus the previous period (less is better). */
  delta: KpiDelta | null;
  paidSec: number;
  unpaidSec: number;
  unknownSec: number;
  rows: PauseRowView[];
}

const share = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

/** `1 h 05 min`, `45 min`, `0 min`: pauses are long, seconds are noise. */
export function formatHoursMinutes(totalSec: number, hourUnit: string, minuteUnit: string): string {
  const minutes = Math.round(Math.max(0, totalSec) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} ${hourUnit} ${String(m).padStart(2, '0')} ${minuteUnit}` : `${m} ${minuteUnit}`;
}

export function buildPausesView(pauses: CcDashboardPauses): PausesView {
  const { reasons, totalSec } = pauses;
  const head = reasons.slice(0, MAX_PAUSE_ROWS);
  const rows: PauseRowView[] = head.map((r) => ({
    reason: r.reason,
    isOther: false,
    count: r.count,
    totalSec: r.totalSec,
    pct: share(r.totalSec, totalSec),
    isPaid: r.isPaid,
  }));

  const tail = reasons.slice(MAX_PAUSE_ROWS);
  if (tail.length > 0) {
    const tailSec = tail.reduce((s, r) => s + r.totalSec, 0);
    rows.push({
      reason: '',
      isOther: true,
      count: tail.reduce((s, r) => s + r.count, 0),
      totalSec: tailSec,
      pct: share(tailSec, totalSec),
      isPaid: null,
    });
  }

  return {
    totalSec,
    count: pauses.count,
    delta: pauses.previousTotalSec === null ? null : kpiDelta(totalSec, pauses.previousTotalSec, 'lowerIsBetter'),
    paidSec: pauses.paidSec,
    unpaidSec: pauses.unpaidSec,
    unknownSec: pauses.unknownSec,
    rows,
  };
}
