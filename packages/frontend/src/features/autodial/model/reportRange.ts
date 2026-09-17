import type { AutodialDisposition } from '@krasterisk/shared';
import type { AutodialSummaryRow } from '@/shared/api/endpoints/autodialApi';

/** Local calendar date as YYYY-MM-DD — the report API is day-granular. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoToday(): string {
  return isoDate(new Date());
}

export function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

export interface DispositionSlice {
  disposition: AutodialDisposition;
  value: number;
}

/**
 * Turn the per-campaign summary into pie slices. The summary carries named
 * counters rather than a disposition map, so the mapping is explicit; empty
 * buckets are dropped so the chart legend stays readable.
 */
export function buildDispositionBreakdown(rows: AutodialSummaryRow[]): DispositionSlice[] {
  const totals: Array<[AutodialDisposition, number]> = [
    ['success', sum(rows, (r) => r.success)],
    ['answered_short', sum(rows, (r) => r.short)],
    ['no_answer', sum(rows, (r) => r.no_answer)],
    ['busy', sum(rows, (r) => r.busy)],
    ['amd_machine', sum(rows, (r) => r.amd)],
    ['failed', sum(rows, (r) => r.failed)],
  ];
  return totals
    .filter(([, value]) => value > 0)
    .map(([disposition, value]) => ({ disposition, value }));
}

function sum(rows: AutodialSummaryRow[], pick: (row: AutodialSummaryRow) => number): number {
  return rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}
