import type { CcDashboardLosses } from '@krasterisk/shared';
import { kpiDelta, type KpiDelta } from './kpiDelta';

export type WaitBucketId = 'upTo5' | 'upTo20' | 'upTo60' | 'over60';

export interface WaitBucketView {
  id: WaitBucketId;
  count: number;
  /** Share of all lost calls, 0-100, one decimal. */
  pct: number;
}

export interface LossesView {
  total: number;
  /** Change of the lost-calls count versus the previous period (fewer is better). */
  delta: KpiDelta | null;
  recoveredByAgent: number;
  clientCalledBack: number;
  pending: number;
  /** Share of lost calls an operator called back in time; `null` when nothing was lost. */
  within15Pct: number | null;
  within60Pct: number | null;
  buckets: WaitBucketView[];
}

const BUCKET_ORDER: readonly WaitBucketId[] = ['upTo5', 'upTo20', 'upTo60', 'over60'];

const share = (part: number, total: number): number => Math.round((part / total) * 1000) / 10;

/** Display model of the "Losses" section: ratios are `null` instead of 0 % when nothing was lost. */
export function buildLossesView(losses: CcDashboardLosses): LossesView {
  const { total } = losses;
  return {
    total,
    delta: losses.previousTotal === null ? null : kpiDelta(total, losses.previousTotal, 'lowerIsBetter'),
    recoveredByAgent: losses.recoveredByAgent,
    clientCalledBack: losses.clientCalledBack,
    pending: losses.pending,
    within15Pct: total > 0 ? share(losses.recoveredWithin15, total) : null,
    within60Pct: total > 0 ? share(losses.recoveredWithin60, total) : null,
    buckets: BUCKET_ORDER.map((id) => ({
      id,
      count: losses.waitBuckets[id],
      pct: total > 0 ? share(losses.waitBuckets[id], total) : 0,
    })),
  };
}
