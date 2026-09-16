import { describe, expect, it } from 'vitest';

import reducer, {
  enterSession,
  leaveSession,
  patchMeta,
  selectConferenceSession,
} from './conferenceSessionSlice';

const idle = () => reducer(undefined, { type: '@@INIT' });

describe('conferenceSessionSlice (16.3-02 D-26)', () => {
  it('selectConferenceSession is null when idle (no enterSession)', () => {
    expect(selectConferenceSession({ conferenceSession: idle() })).toBeNull();
  });

  it('enterSession stores roomUid, short number, role, and startedAt', () => {
    const next = reducer(
      idle(),
      enterSession({
        roomUid: 77,
        number: '6001',
        name: 'Standup',
        role: 'moderator',
        sipId: 'ew101',
        startedAt: '2026-09-16T12:00:00.000Z',
      }),
    );
    expect(next.roomUid).toBe(77);
    expect(next.number).toBe('6001');
    expect(next.name).toBe('Standup');
    expect(next.role).toBe('moderator');
    expect(next.sipId).toBe('ew101');
    expect(next.startedAt).toBe('2026-09-16T12:00:00.000Z');
    expect(selectConferenceSession({ conferenceSession: next })).toEqual(next);
  });

  it('leaveSession returns selectConferenceSession to null', () => {
    const active = reducer(
      idle(),
      enterSession({
        roomUid: 77,
        number: '6001',
        role: 'participant',
      }),
    );
    const next = reducer(active, leaveSession());
    expect(selectConferenceSession({ conferenceSession: next })).toBeNull();
    expect(next.roomUid).toBeNull();
    expect(next.startedAt).toBeNull();
  });

  it('patchMeta updates name/role without dropping the session', () => {
    const active = reducer(
      idle(),
      enterSession({
        roomUid: 9,
        number: '6002',
        name: 'Old',
        role: 'participant',
        startedAt: '2026-09-16T12:00:00.000Z',
      }),
    );
    const next = reducer(active, patchMeta({ name: 'New', role: 'moderator' }));
    expect(next.roomUid).toBe(9);
    expect(next.name).toBe('New');
    expect(next.role).toBe('moderator');
    expect(selectConferenceSession({ conferenceSession: next })).not.toBeNull();
  });
});
