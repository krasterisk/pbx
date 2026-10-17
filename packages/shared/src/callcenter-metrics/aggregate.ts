import { classifyQueueCall, type MetricsConfig, type QueueCallLike } from './classify';

/**
 * Additive per-queue totals. Everything is a SUM or COUNT so partial results
 * (live accumulators, daily rollup rows, hourly buckets) merge without precision loss.
 */
export interface QueueTotals {
  /** All queue calls that entered the queue (includes short abandons). */
  offered: number;
  /** answered + transferred. */
  handled: number;
  /** Handled with wait ≤ SLA threshold. */
  handledInSl: number;
  /** Abandoned/timeout beyond the short-abandon window. */
  abandoned: number;
  /** Abandoned/timeout within the short-abandon window (excluded from effective offered). */
  shortAbandoned: number;
  /** Subset of handled that ended as a blind/attended transfer. */
  transferred: number;
  sumWaitHandled: number;
  sumTalkHandled: number;
  sumWrapupHandled: number;
  /** Informational: talk_time already contains hold time, so hold is never added to AHT. */
  sumHoldHandled: number;
  sumWaitAbandoned: number;
  maxWait: number;
}

export function emptyQueueTotals(): QueueTotals {
  return {
    offered: 0,
    handled: 0,
    handledInSl: 0,
    abandoned: 0,
    shortAbandoned: 0,
    transferred: 0,
    sumWaitHandled: 0,
    sumTalkHandled: 0,
    sumWrapupHandled: 0,
    sumHoldHandled: 0,
    sumWaitAbandoned: 0,
    maxWait: 0,
  };
}

const sec = (value: number | null | undefined): number => Math.max(0, Math.round(Number(value) || 0));

/** Add one queue-call row to the totals in place. Caller must have filtered with `isQueueCallRow`. */
export function addQueueCall(
  totals: QueueTotals,
  row: QueueCallLike,
  config: MetricsConfig,
): QueueTotals {
  const wait = sec(row.wait_time);
  const outcome = classifyQueueCall(row, config);
  totals.offered += 1;
  if (wait > totals.maxWait) totals.maxWait = wait;

  if (outcome === 'handled') {
    totals.handled += 1;
    if (row.disposition === 'transferred') totals.transferred += 1;
    totals.sumWaitHandled += wait;
    totals.sumTalkHandled += sec(row.talk_time);
    totals.sumWrapupHandled += sec(row.wrapup_time);
    totals.sumHoldHandled += sec(row.hold_time);
    if (wait <= config.slaThresholdSec) totals.handledInSl += 1;
  } else if (outcome === 'abandoned') {
    totals.abandoned += 1;
    totals.sumWaitAbandoned += wait;
  } else if (outcome === 'shortAbandoned') {
    totals.shortAbandoned += 1;
    totals.sumWaitAbandoned += wait;
  }
  return totals;
}

/** Merge `source` into `target` in place (used to roll queue totals into tenant totals / days into ranges). */
export function mergeQueueTotals(target: QueueTotals, source: QueueTotals): QueueTotals {
  target.offered += source.offered;
  target.handled += source.handled;
  target.handledInSl += source.handledInSl;
  target.abandoned += source.abandoned;
  target.shortAbandoned += source.shortAbandoned;
  target.transferred += source.transferred;
  target.sumWaitHandled += source.sumWaitHandled;
  target.sumTalkHandled += source.sumTalkHandled;
  target.sumWrapupHandled += source.sumWrapupHandled;
  target.sumHoldHandled += source.sumHoldHandled;
  target.sumWaitAbandoned += source.sumWaitAbandoned;
  target.maxWait = Math.max(target.maxWait, source.maxWait);
  return target;
}
