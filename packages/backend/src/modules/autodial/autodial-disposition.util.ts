import {
  AUTODIAL_TERMINAL_DISPOSITIONS,
  type AutodialDisposition,
  type IAutodialRetryConfig,
} from '@krasterisk/shared';

/**
 * Map an Asterisk hangup cause to a disposition for a call that was never
 * answered. Cause numbers follow Q.850 as reported by ARI ChannelDestroyed.
 */
export function dispositionFromHangupCause(cause: number): AutodialDisposition {
  switch (cause) {
    case 16: // Normal clearing — nobody picked up before we tore it down
    case 19: // No answer from user
    case 18: // No user responding
      return 'no_answer';
    case 17: // User busy
      return 'busy';
    case 34: // No circuit available
    case 42: // Switching equipment congestion
    case 44: // Requested channel not available
      return 'congestion';
    case 1: // Unallocated number
    case 2: // No route to specified transit network
    case 3: // No route to destination
    case 22: // Number changed
    case 28: // Invalid number format
      return 'invalid_number';
    case 21: // Call rejected
    case 27: // Destination out of order
      return 'failed';
    default:
      return 'failed';
  }
}

/**
 * Answered calls are judged by talk time: anything below `success_min_sec` is
 * `answered_short`, which is retryable, unlike `success`.
 */
export function dispositionFromAnsweredCall(params: {
  billsec: number;
  successMinSec: number;
  amdResult?: string | null;
}): AutodialDisposition {
  if (params.amdResult && params.amdResult.toUpperCase() === 'MACHINE') {
    return 'amd_machine';
  }
  return params.billsec >= params.successMinSec ? 'success' : 'answered_short';
}

export function isTerminalDisposition(d: AutodialDisposition): boolean {
  return AUTODIAL_TERMINAL_DISPOSITIONS.includes(d);
}

export interface RetryDecision {
  retry: boolean;
  /** Only set when retry is true */
  nextAttemptAt?: Date;
  /** Disposition to persist on the task (may be promoted to max_attempts) */
  disposition: AutodialDisposition;
}

/**
 * Decide whether a task gets another attempt. Exhausting `max_attempts` is
 * recorded as `max_attempts` rather than the last transient cause, so reports
 * can tell "we gave up" from "the line was busy once".
 */
export function decideRetry(params: {
  disposition: AutodialDisposition;
  attemptCount: number;
  retry: IAutodialRetryConfig;
  now: Date;
}): RetryDecision {
  const { disposition, attemptCount, retry, now } = params;

  if (isTerminalDisposition(disposition)) {
    return { retry: false, disposition };
  }
  if (attemptCount >= Math.max(1, retry.max_attempts)) {
    return { retry: false, disposition: 'max_attempts' };
  }

  const intervalSec =
    retry.intervals_sec?.[disposition] ?? retry.default_interval_sec ?? 3600;
  return {
    retry: true,
    disposition,
    nextAttemptAt: new Date(now.getTime() + Math.max(0, intervalSec) * 1000),
  };
}
