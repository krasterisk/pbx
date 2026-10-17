import { emptyQueueTotals, type QueueTotals } from '@krasterisk/shared';

/** Columns shared by `cc_daily_queue_stats` (v2) and `cc_interval_queue_stats`. */
export interface QueueAggRow {
  total_calls: number;
  answered_calls: number;
  abandoned_calls: number;
  short_abandoned_calls?: number | null;
  transferred_calls?: number | null;
  sla_met_calls: number;
  total_wait_sec?: number | null;
  total_talk_sec: number;
  total_hold_sec?: number | null;
  total_wrapup_sec?: number | null;
  max_wait_sec: number;
}

export type QueueAggColumns = Required<
  Pick<
    QueueAggRow,
    | 'total_calls'
    | 'answered_calls'
    | 'abandoned_calls'
    | 'short_abandoned_calls'
    | 'transferred_calls'
    | 'sla_met_calls'
    | 'total_wait_sec'
    | 'total_talk_sec'
    | 'total_hold_sec'
    | 'total_wrapup_sec'
    | 'max_wait_sec'
  >
>;

/** Stored aggregate row → additive dictionary totals. `sumWaitHandled` overrides legacy (v1) rows. */
export function queueTotalsFromAggRow(row: QueueAggRow, sumWaitHandled?: number): QueueTotals {
  return {
    ...emptyQueueTotals(),
    offered: row.total_calls,
    handled: row.answered_calls,
    handledInSl: row.sla_met_calls,
    abandoned: row.abandoned_calls,
    shortAbandoned: row.short_abandoned_calls ?? 0,
    transferred: row.transferred_calls ?? 0,
    sumWaitHandled: sumWaitHandled ?? row.total_wait_sec ?? 0,
    sumTalkHandled: row.total_talk_sec,
    sumWrapupHandled: row.total_wrapup_sec ?? 0,
    sumHoldHandled: row.total_hold_sec ?? 0,
    sumWaitAbandoned: 0,
    maxWait: row.max_wait_sec,
  };
}

/** Dictionary totals → stored aggregate columns. */
export function queueTotalsToAggColumns(t: QueueTotals): QueueAggColumns {
  return {
    total_calls: t.offered,
    answered_calls: t.handled,
    abandoned_calls: t.abandoned,
    short_abandoned_calls: t.shortAbandoned,
    transferred_calls: t.transferred,
    sla_met_calls: t.handledInSl,
    total_wait_sec: t.sumWaitHandled,
    total_talk_sec: t.sumTalkHandled,
    total_hold_sec: t.sumHoldHandled,
    total_wrapup_sec: t.sumWrapupHandled,
    max_wait_sec: t.maxWait,
  };
}
