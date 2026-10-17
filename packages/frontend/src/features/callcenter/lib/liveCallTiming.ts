import type { ICall } from '../model/types/callCenterSchema';

/**
 * Live-call timing helpers for the supervisor cockpit.
 * Pure functions of (call, now): the caller passes the clock so rows can tick independently
 * and tests stay deterministic.
 */

function toMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clampSec(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

/** A caller who has not been picked up yet (in queue or ringing an agent). */
export function isPendingCall(call: Pick<ICall, 'status'>): boolean {
  return call.status === 'WAITING' || call.status === 'RINGING';
}

/** A call with a live conversation (talking or on hold). */
export function isActiveCall(call: Pick<ICall, 'status'>): boolean {
  return call.status === 'TALKING' || call.status === 'HOLD';
}

/**
 * Seconds the caller waited. Ticks for pending calls; frozen at the answer moment for answered ones.
 */
export function callWaitSec(call: ICall, nowMs: number): number {
  const enter = toMs(call.enterTime);
  if (enter == null) return 0;
  if (isPendingCall(call)) return clampSec(nowMs - enter);
  const answered = toMs(call.answerTime);
  return answered == null ? 0 : clampSec(answered - enter);
}

/** Seconds in conversation (includes hold). Zero for calls that are not answered yet. */
export function callTalkSec(call: ICall, nowMs: number): number {
  if (!isActiveCall(call)) return 0;
  const answered = toMs(call.answerTime);
  if (answered == null) return Math.max(0, call.talkTime || 0);
  return clampSec(nowMs - answered);
}

/** Longest waiting caller (queue-level or tenant-wide). Ringing calls are already assigned to an agent. */
export function longestWaitSec(calls: readonly ICall[], nowMs: number, queueName?: string): number {
  const wanted = queueName?.toLowerCase();
  let longest = 0;
  for (const call of calls) {
    if (call.status !== 'WAITING') continue;
    if (wanted != null && call.queue.toLowerCase() !== wanted) continue;
    longest = Math.max(longest, callWaitSec(call, nowMs));
  }
  return longest;
}

const STATUS_RANK: Record<string, number> = {
  WAITING: 0,
  RINGING: 1,
  TALKING: 2,
  HOLD: 2,
};

/**
 * Supervisor order: the caller who has waited longest first, then ringing, then conversations by
 * length. Sorting by timestamps (not by the ticking duration) keeps the order stable between ticks.
 */
export function sortLiveCalls(calls: readonly ICall[]): ICall[] {
  const keyOf = (call: ICall): number => {
    const stamp = isActiveCall(call) ? toMs(call.answerTime) : toMs(call.enterTime);
    return stamp ?? Number.MAX_SAFE_INTEGER;
  };
  return [...calls].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
    if (rank !== 0) return rank;
    return keyOf(a) - keyOf(b);
  });
}

/** `m:ss`, or `h:mm:ss` from one hour. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
