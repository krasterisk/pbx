import type { QueueRecentSla } from '@/shared/api/endpoints/callCenterReportsApi';

export interface QueueSlaTrend {
  /** SLA of the last half hour, percent. */
  sla: number;
  /** Change versus the half hour before, in percentage points; `null` when there is nothing to compare. */
  delta: number | null;
  direction: 'up' | 'down' | 'flat';
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Per-queue "is it getting better right now". A queue with no countable traffic in the last half
 * hour has no entry at all: there is no verdict to show, and an arrow from nothing would mislead.
 */
export function buildSlaTrends(rows: readonly QueueRecentSla[] | undefined): Record<string, QueueSlaTrend> {
  const out: Record<string, QueueSlaTrend> = {};
  for (const row of rows ?? []) {
    if (row.sla === null) continue;
    const delta = row.previousSla === null ? null : round1(row.sla - row.previousSla);
    out[row.queueName] = {
      sla: row.sla,
      delta,
      direction: delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
    };
  }
  return out;
}
