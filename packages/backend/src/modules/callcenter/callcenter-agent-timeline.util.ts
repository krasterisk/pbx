/**
 * Agent journal (cc_agent_events) → timeline states.
 *
 * One mapping for everything that reads the journal: the agent timeline / pause reports and the
 * occupancy restore of the live metrics. Keeping it in one place is what makes "READY seconds"
 * mean the same thing in the wallboard and in the reports.
 */
export type AgentTimelineState =
  | 'READY'
  | 'PAUSED'
  | 'IN_CALL'
  | 'HOLD'
  | 'WRAPUP'
  | 'DIALING'
  | 'CONSULT'
  | 'ACW'
  | 'OFFLINE';

export function eventTypeToTimelineState(eventType: string): AgentTimelineState {
  switch (eventType) {
    case 'LOGIN':
    case 'READY':
    case 'CALL_END':
    case 'WRAPUP_END':
      return 'READY';
    case 'PAUSE':
      return 'PAUSED';
    case 'CALL_START':
    case 'UNHOLD':
      return 'IN_CALL';
    case 'HOLD':
      return 'HOLD';
    case 'WRAPUP_START':
      return 'WRAPUP';
    case 'DIALING':
      return 'DIALING';
    case 'CONSULT':
      return 'CONSULT';
    case 'ACW':
      return 'ACW';
    case 'LOGOUT':
    default:
      return 'OFFLINE';
  }
}

export interface JournalEventLike {
  event_type: string;
  created_at?: Date | null;
}

export interface SessionReadyWindow {
  /** Seconds spent READY inside the window. */
  readySec: number;
  /** State at the end of the (clipped) window, for restoring a live status track. */
  endState: AgentTimelineState | null;
}

/**
 * READY seconds of one session inside [windowStart, windowEnd].
 * `events` must be ordered by time; the last event runs until `sessionEnd`.
 */
export function readySecondsInWindow(
  events: JournalEventLike[],
  sessionEnd: Date,
  windowStart: Date,
  windowEnd: Date,
): SessionReadyWindow {
  let readySec = 0;
  let endState: AgentTimelineState | null = null;
  const lo = windowStart.getTime();
  const hi = Math.min(windowEnd.getTime(), sessionEnd.getTime());

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const startMs = (ev.created_at ?? sessionEnd).getTime();
    const endMs = i + 1 < events.length ? (events[i + 1].created_at ?? sessionEnd).getTime() : sessionEnd.getTime();
    const state = eventTypeToTimelineState(ev.event_type);
    if (startMs <= hi) endState = state;
    const from = Math.max(startMs, lo);
    const to = Math.min(endMs, hi);
    if (state === 'READY' && to > from) readySec += Math.round((to - from) / 1000);
  }
  return { readySec, endState };
}
