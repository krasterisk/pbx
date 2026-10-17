import { eventTypeToTimelineState, readySecondsInWindow } from './callcenter-agent-timeline.util';

const at = (iso: string) => new Date(iso);

describe('eventTypeToTimelineState', () => {
  it('maps journal events to states', () => {
    expect(eventTypeToTimelineState('LOGIN')).toBe('READY');
    expect(eventTypeToTimelineState('CALL_END')).toBe('READY');
    expect(eventTypeToTimelineState('PAUSE')).toBe('PAUSED');
    expect(eventTypeToTimelineState('CALL_START')).toBe('IN_CALL');
    expect(eventTypeToTimelineState('HOLD')).toBe('HOLD');
    expect(eventTypeToTimelineState('WRAPUP_START')).toBe('WRAPUP');
    expect(eventTypeToTimelineState('LOGOUT')).toBe('OFFLINE');
    expect(eventTypeToTimelineState('SOMETHING_NEW')).toBe('OFFLINE');
  });
});

describe('readySecondsInWindow', () => {
  const events = [
    { event_type: 'LOGIN', created_at: at('2026-07-14T22:00:00.000Z') },
    { event_type: 'CALL_START', created_at: at('2026-07-15T01:00:00.000Z') },
    { event_type: 'CALL_END', created_at: at('2026-07-15T01:10:00.000Z') },
    { event_type: 'PAUSE', created_at: at('2026-07-15T03:00:00.000Z') },
  ];
  const windowStart = at('2026-07-15T00:00:00.000Z');
  const windowEnd = at('2026-07-15T06:00:00.000Z');

  it('counts only the READY time inside the window (clips a night shift at midnight)', () => {
    const sessionEnd = at('2026-07-15T06:00:00.000Z');
    const { readySec, endState } = readySecondsInWindow(events, sessionEnd, windowStart, windowEnd);
    // 00:00-01:00 and 01:10-03:00 are READY; the 22:00-00:00 part belongs to the previous day.
    expect(readySec).toBe(3600 + 6600);
    expect(endState).toBe('PAUSED');
  });

  it('runs the last event to the window end for an open session', () => {
    const open = [{ event_type: 'READY', created_at: at('2026-07-15T05:00:00.000Z') }];
    const { readySec, endState } = readySecondsInWindow(open, at('2026-07-15T09:00:00.000Z'), windowStart, windowEnd);
    expect(readySec).toBe(3600);
    expect(endState).toBe('READY');
  });

  it('returns nothing for a session without events', () => {
    expect(readySecondsInWindow([], windowEnd, windowStart, windowEnd)).toEqual({ readySec: 0, endState: null });
  });
});
