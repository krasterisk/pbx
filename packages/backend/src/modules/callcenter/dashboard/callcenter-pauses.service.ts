import { Injectable } from '@nestjs/common';
import type { CcDashboardPauseReason, CcDashboardPauses } from '@krasterisk/shared';
import { CallCenterReportsService } from '../reports/callcenter-reports.service';
import type { PauseReportRow } from '../reports/callcenter-reports.types';

/** Folds the per-operator pause report into one row per reason; paid / unpaid come from the catalog. */
export function foldPauseRows(rows: readonly PauseReportRow[]): Omit<CcDashboardPauses, 'previousTotalSec'> {
  const byReason = new Map<string, CcDashboardPauseReason>();
  let paidSec = 0;
  let unpaidSec = 0;
  let unknownSec = 0;
  let count = 0;
  let totalSec = 0;

  for (const row of rows) {
    const isPaid = row.isPaid === undefined ? null : row.isPaid;
    const entry = byReason.get(row.pauseReason) ?? { reason: row.pauseReason, count: 0, totalSec: 0, isPaid };
    entry.count += row.pauseCount;
    entry.totalSec += row.totalPauseSec;
    byReason.set(row.pauseReason, entry);

    count += row.pauseCount;
    totalSec += row.totalPauseSec;
    if (isPaid === true) paidSec += row.totalPauseSec;
    else if (isPaid === false) unpaidSec += row.totalPauseSec;
    else unknownSec += row.totalPauseSec;
  }

  const reasons = [...byReason.values()].sort((a, b) => b.totalSec - a.totalSec || a.reason.localeCompare(b.reason));
  return { count, totalSec, paidSec, unpaidSec, unknownSec, reasons };
}

/**
 * Pauses for the management dashboard. Reuses the pause report so the dashboard and the report
 * cannot disagree; the report's end bound is inclusive, hence `to - 1 ms`.
 */
@Injectable()
export class CallCenterPausesService {
  constructor(private readonly reports: CallCenterReportsService) {}

  private async totals(userUid: number, window: { from: Date; to: Date }) {
    const result = await this.reports.getPauseReport(userUid, {
      dateFrom: window.from.toISOString(),
      dateTo: new Date(window.to.getTime() - 1).toISOString(),
    });
    return foldPauseRows(result.rows);
  }

  async getPauses(
    userUid: number,
    window: { from: Date; to: Date },
    previous: { from: Date; to: Date } | null,
  ): Promise<CcDashboardPauses> {
    const [current, before] = await Promise.all([
      this.totals(userUid, window),
      previous ? this.totals(userUid, previous) : Promise.resolve(null),
    ]);
    return { ...current, previousTotalSec: before ? before.totalSec : null };
  }
}
