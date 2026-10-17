import type { QueueIntervalPoint, QueueIntervalsResult } from '@/shared/api/endpoints/callCenterReportsApi';

export interface IntradayChartPoint {
  /** ISO instant of the interval start (stable key / tooltip source). */
  at: string;
  /** Tenant-local `HH:mm`. */
  label: string;
  answered: number;
  /** Real abandons (short abandons are shown separately - they are excluded from SLA/abandon rate). */
  abandoned: number;
  shortAbandoned: number;
  /** Running service level of the day so far; `null` before the first call so the line does not start at 0. */
  cumulativeSla: number | null;
  /** Calls offered in the same interval one week earlier; `null` without comparison. */
  previousOffered: number | null;
}

export interface IntradaySummary {
  offered: number;
  answered: number;
  abandoned: number;
  /** Running SLA at the last point, `null` when nothing was offered. */
  sla: number | null;
  /** Busiest interval by offered calls (first one wins on ties), `null` without traffic. */
  peak: { at: string; offered: number } | null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }
  formatters.set(timeZone, formatter);
  return formatter;
}

/** `HH:mm` of an instant in the tenant timezone (never the browser zone). */
export function formatIntervalLabel(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return getFormatter(timeZone).format(new Date(ms));
}

export function buildIntradayChartData(result: QueueIntervalsResult | undefined): IntradayChartPoint[] {
  if (!result) return [];
  const previous = result.previous;
  return result.rows.map((row, index) => ({
    at: row.start,
    label: formatIntervalLabel(row.start, result.timezone),
    answered: row.answered,
    abandoned: row.abandoned,
    shortAbandoned: row.shortAbandoned,
    cumulativeSla: row.cumulativeOffered > 0 ? row.cumulativeSla : null,
    previousOffered: previous ? (previous[index]?.offered ?? 0) : null,
  }));
}

export function hasIntradayTraffic(rows: readonly QueueIntervalPoint[] | undefined): boolean {
  return !!rows && rows.some((row) => row.offered > 0);
}

export function summarizeIntraday(rows: readonly QueueIntervalPoint[] | undefined): IntradaySummary {
  const summary: IntradaySummary = { offered: 0, answered: 0, abandoned: 0, sla: null, peak: null };
  if (!rows || rows.length === 0) return summary;
  for (const row of rows) {
    summary.offered += row.offered;
    summary.answered += row.answered;
    summary.abandoned += row.abandoned;
    if (row.offered > 0 && (summary.peak === null || row.offered > summary.peak.offered)) {
      summary.peak = { at: row.start, offered: row.offered };
    }
  }
  const last = rows[rows.length - 1];
  summary.sla = last.cumulativeOffered > 0 ? last.cumulativeSla : null;
  return summary;
}
