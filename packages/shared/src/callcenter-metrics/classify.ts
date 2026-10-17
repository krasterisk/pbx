import {
  DEFAULT_SHORT_ABANDON_SEC,
  DEFAULT_SLA_THRESHOLD_SEC,
  DIRECT_QUEUE_PREFIX,
  MAX_SHORT_ABANDON_SEC,
  MIN_SHORT_ABANDON_SEC,
  QUEUE_CALL_DIRECTION,
} from './constants';

/** Minimal row shape needed to classify a call (matches `cc_queue_calls`). */
export interface QueueCallLike {
  queue_name?: string | null;
  direction?: string | null;
  disposition?: string | null;
  wait_time?: number | null;
  talk_time?: number | null;
  hold_time?: number | null;
  wrapup_time?: number | null;
}

export interface MetricsConfig {
  slaThresholdSec: number;
  shortAbandonSec: number;
}

export type QueueCallOutcome = 'handled' | 'abandoned' | 'shortAbandoned' | 'other';

export function isDirectQueueName(queueName: string | null | undefined): boolean {
  return typeof queueName === 'string' && queueName.startsWith(DIRECT_QUEUE_PREFIX);
}

/**
 * A "queue call" is an inbound call that entered a real queue.
 * Outbound/internal rows and `direct:<iface>` pseudo-queues are a separate stream.
 */
export function isQueueCallRow(row: Pick<QueueCallLike, 'queue_name' | 'direction'>): boolean {
  if (!row.queue_name || isDirectQueueName(row.queue_name)) return false;
  const direction = row.direction || QUEUE_CALL_DIRECTION;
  return direction === QUEUE_CALL_DIRECTION;
}

export function isHandledDisposition(disposition: string | null | undefined): boolean {
  return disposition === 'answered' || disposition === 'transferred';
}

export function isAbandonedDisposition(disposition: string | null | undefined): boolean {
  return disposition === 'abandoned' || disposition === 'timeout';
}

export function normalizeShortAbandonSec(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_SHORT_ABANDON_SEC;
  return Math.min(MAX_SHORT_ABANDON_SEC, Math.max(MIN_SHORT_ABANDON_SEC, Math.round(n)));
}

export function normalizeSlaThresholdSec(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return DEFAULT_SLA_THRESHOLD_SEC;
  return Math.round(n);
}

/**
 * Single classification used by live restore, raw reports and rollup.
 * - answered/transferred → handled
 * - abandoned/timeout with wait ≤ shortAbandonSec → shortAbandoned (excluded from offered)
 * - abandoned/timeout otherwise → abandoned
 */
export function classifyQueueCall(
  row: Pick<QueueCallLike, 'disposition' | 'wait_time'>,
  config: Pick<MetricsConfig, 'shortAbandonSec'>,
): QueueCallOutcome {
  if (isHandledDisposition(row.disposition)) return 'handled';
  if (isAbandonedDisposition(row.disposition)) {
    const wait = Math.max(0, Number(row.wait_time) || 0);
    // shortAbandonSec = 0 disables the exclusion entirely.
    return config.shortAbandonSec > 0 && wait <= config.shortAbandonSec ? 'shortAbandoned' : 'abandoned';
  }
  return 'other';
}
