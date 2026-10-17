import { Injectable } from '@nestjs/common';
import type { CcDashboardOperatorFlag, CcDashboardOperatorOutlier, CcDashboardOperators } from '@krasterisk/shared';
import { CallCenterReportsService } from '../reports/callcenter-reports.service';
import type { OperatorStatsRow } from '../reports/callcenter-reports.types';

/** An operator needs this many handled calls before their AHT says anything. */
export const MIN_CALLS_FOR_AHT = 5;
/** ...and this much logged-in time before their pause share does (30 minutes). */
export const MIN_LOGGED_IN_SEC = 30 * 60;
/** Fewer evaluated operators than this: a median is just somebody's own number. */
export const MIN_OPERATORS_FOR_MEDIAN = 3;
/** AHT above this multiple of the median is flagged. */
export const AHT_FLAG_RATIO = 1.5;
/** Pause share above this multiple of the median (and above the floor) is flagged. */
export const PAUSE_FLAG_RATIO = 1.5;
export const PAUSE_FLAG_FLOOR_PCT = 20;
export const MAX_OUTLIERS = 10;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Evaluated {
  row: OperatorStatsRow;
  hasAht: boolean;
  hasPause: boolean;
  pauseSharePct: number;
}

/** Operators who stand out from the median of their colleagues: long handle time, long pauses. */
export function findOperatorDeviations(rows: readonly OperatorStatsRow[]): CcDashboardOperators {
  const evaluated: Evaluated[] = rows.map((row) => {
    const loggedIn = row.loggedInSec ?? 0;
    return {
      row,
      hasAht: row.callsHandled >= MIN_CALLS_FOR_AHT,
      hasPause: loggedIn >= MIN_LOGGED_IN_SEC,
      pauseSharePct: loggedIn > 0 ? round1(((row.totalPauseSec ?? 0) / loggedIn) * 100) : 0,
    };
  });

  const ahtPool = evaluated.filter((e) => e.hasAht);
  const pausePool = evaluated.filter((e) => e.hasPause);
  const medianAht = ahtPool.length >= MIN_OPERATORS_FOR_MEDIAN ? median(ahtPool.map((e) => e.row.ahtSec)) : null;
  const medianPause = pausePool.length >= MIN_OPERATORS_FOR_MEDIAN ? median(pausePool.map((e) => e.pauseSharePct)) : null;

  const outliers: Array<CcDashboardOperatorOutlier & { gap: number }> = [];
  for (const e of evaluated) {
    const flags: CcDashboardOperatorFlag[] = [];
    let gap = 0;
    if (medianAht !== null && medianAht > 0 && e.hasAht && e.row.ahtSec > medianAht * AHT_FLAG_RATIO) {
      flags.push('highAht');
      gap += e.row.ahtSec / medianAht;
    }
    if (
      medianPause !== null &&
      e.hasPause &&
      e.pauseSharePct >= PAUSE_FLAG_FLOOR_PCT &&
      e.pauseSharePct > medianPause * PAUSE_FLAG_RATIO
    ) {
      flags.push('highPause');
      gap += medianPause > 0 ? e.pauseSharePct / medianPause : e.pauseSharePct;
    }
    if (flags.length === 0) continue;
    outliers.push({
      agentInterface: e.row.agentInterface,
      agentUserUid: e.row.agentUserUid,
      callsHandled: e.row.callsHandled,
      ahtSec: e.row.ahtSec,
      pauseSharePct: e.pauseSharePct,
      loggedInSec: e.row.loggedInSec ?? 0,
      flags,
      gap,
    });
  }

  outliers.sort((a, b) => b.flags.length - a.flags.length || b.gap - a.gap || a.agentInterface.localeCompare(b.agentInterface));

  return {
    evaluated: new Set([...ahtPool, ...pausePool].map((e) => e.row.agentInterface)).size,
    medianAhtSec: medianAht === null ? null : Math.round(medianAht),
    medianPauseSharePct: medianPause === null ? null : round1(medianPause),
    outliers: outliers.slice(0, MAX_OUTLIERS).map(({ gap: _gap, ...outlier }) => outlier),
  };
}

/**
 * Operator deviations for the management dashboard. Built on the operator-stats report so the
 * dashboard and the report show the same AHT and pause numbers.
 */
@Injectable()
export class CallCenterOperatorsService {
  constructor(private readonly reports: CallCenterReportsService) {}

  async getDeviations(userUid: number, window: { from: Date; to: Date }): Promise<CcDashboardOperators> {
    const result = await this.reports.getOperatorStats(userUid, {
      dateFrom: window.from.toISOString(),
      dateTo: new Date(window.to.getTime() - 1).toISOString(),
    });
    return findOperatorDeviations(result.rows);
  }
}
