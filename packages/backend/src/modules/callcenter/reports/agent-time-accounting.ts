/**
 * Shift time from the agent journal, clipped to the report window.
 * Stored session totals are not used: they miss READY between calls and count a pause only after it ends.
 */
import { eventTypeToTimelineState, type AgentTimelineState } from '../callcenter-agent-timeline.util';

export const BUSY_STATES = new Set<AgentTimelineState>([
  'IN_CALL', 'HOLD', 'WRAPUP', 'ACW', 'DIALING', 'CONSULT',
]);

export interface JournalEventLike {
  event_type: string;
  created_at?: Date | string | null;
  reason?: string | null;
}

export interface AccountedTime {
  loggedInSec: number;
  readySec: number;
  busySec: number;
  pausePaidSec: number;
  pauseUnpaidSec: number;
  pauseUnknownSec: number;
}

export interface PauseSlice {
  reason: string;
  sec: number;
  isPaid: boolean | null;
}

const ZERO: AccountedTime = {
  loggedInSec: 0, readySec: 0, busySec: 0, pausePaidSec: 0, pauseUnpaidSec: 0, pauseUnknownSec: 0,
};

function at(value: Date | string | null | undefined): number {
  if (!value) return NaN;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Seconds of one session inside [from, to], split by journal state.
 * An open shift ends at `now`. Rounding leftover is added to ready time so
 * ready + busy + pauses = logged in.
 */
export function accountSessionTime(input: {
  events: readonly JournalEventLike[];
  login: Date;
  logout: Date | null;
  from: Date;
  to: Date;
  now: Date;
  isPaid?: (reason: string) => boolean | null;
}): AccountedTime & { pauses: PauseSlice[] } {
  const loginMs = at(input.login);
  const nowMs = at(input.now);
  const logoutMs = input.logout ? at(input.logout) : nowMs;
  const winStart = Math.max(loginMs, at(input.from));
  const winEnd = Math.min(logoutMs, at(input.to), nowMs);
  if (!Number.isFinite(winStart) || !Number.isFinite(winEnd) || winEnd <= winStart) {
    return { ...ZERO, pauses: [] };
  }

  const ordered = [...input.events]
    .map((ev) => ({ ev, ms: at(ev.created_at) }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms);

  let state: AgentTimelineState = 'READY';
  let reason = '';
  let cursor = winStart;
  const totals: AccountedTime = { ...ZERO, loggedInSec: Math.round((winEnd - winStart) / 1000) };
  const pauses: PauseSlice[] = [];

  const add = (nextState: AgentTimelineState, nextReason: string, fromMs: number, toMs: number) => {
    if (toMs <= fromMs) return;
    const sec = Math.round((toMs - fromMs) / 1000);
    if (sec <= 0) return;
    if (nextState === 'PAUSED') {
      const paid = nextReason ? (input.isPaid?.(nextReason) ?? null) : null;
      if (paid === true) totals.pausePaidSec += sec;
      else if (paid === false) totals.pauseUnpaidSec += sec;
      else totals.pauseUnknownSec += sec;
      pauses.push({ reason: nextReason || '(none)', sec, isPaid: paid });
    } else if (BUSY_STATES.has(nextState)) {
      totals.busySec += sec;
    } else if (nextState === 'READY') {
      totals.readySec += sec;
    }
  };

  for (const row of ordered) {
    if (row.ms <= winStart) {
      state = eventTypeToTimelineState(row.ev.event_type);
      reason = String(row.ev.reason || '');
      continue;
    }
    if (row.ms >= winEnd) break;
    add(state, reason, cursor, row.ms);
    cursor = row.ms;
    state = eventTypeToTimelineState(row.ev.event_type);
    reason = String(row.ev.reason || '');
  }
  add(state, reason, cursor, winEnd);

  const spent = totals.readySec + totals.busySec + totals.pausePaidSec + totals.pauseUnpaidSec + totals.pauseUnknownSec;
  totals.readySec += totals.loggedInSec - spent;
  if (totals.readySec < 0) totals.readySec = 0;
  return { ...totals, pauses };
}
