/**
 * Classifies outbound softphone failures for operator-facing messages.
 * Asterisk dialplan errors (invalid extension) often Answer then BYE immediately
 * - that surfaces as `ended_early`, not a SIP 4xx on INVITE.
 */

export type DialFailureKind =
  | 'busy'
  | 'not_found'
  | 'unavailable'
  | 'declined'
  | 'rejected'
  | 'ended_early'
  | 'failed';

export interface DialFailure {
  kind: DialFailureKind;
  /** SIP final response code when INVITE was rejected. */
  statusCode?: number;
  target?: string;
}

/** Map SIP INVITE final response → failure kind. */
export function dialFailureFromSipStatus(statusCode?: number): DialFailureKind {
  if (statusCode == null) return 'failed';
  if (statusCode === 486 || statusCode === 600) return 'busy';
  if (statusCode === 404 || statusCode === 484) return 'not_found';
  if (statusCode === 480 || statusCode === 408 || statusCode === 503) return 'unavailable';
  if (statusCode === 603) return 'declined';
  if (statusCode >= 400 && statusCode < 700) return 'rejected';
  return 'failed';
}

/**
 * Outbound session ended (remote BYE / cancel) - report only when the attempt
 * never connected or dropped within earlyMs (dialplan Hangup / invalid ext).
 * Returns null for a normal completed call.
 */
export function dialFailureFromOutboundEnd(opts: {
  establishedAt: number | null;
  now?: number;
  earlyMs?: number;
}): DialFailureKind | null {
  const now = opts.now ?? Date.now();
  const earlyMs = opts.earlyMs ?? 3000;
  if (opts.establishedAt == null) return 'failed';
  if (now - opts.establishedAt < earlyMs) return 'ended_early';
  return null;
}
