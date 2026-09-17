import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { conferenceSdhFactory } from './conferenceSdhFactory';

type StateListener<T> = (state: T) => void;

const uaCtor = vi.fn();
const registererCtor = vi.fn();
const inviterCtor = vi.fn();

class MockRegisterer {
  state = 'Unregistered';
  private listeners: StateListener<string>[] = [];
  register = vi.fn(async () => undefined);
  unregister = vi.fn(async () => undefined);
  stateChange = {
    addListener: (fn: StateListener<string>) => {
      this.listeners.push(fn);
    },
  };

  emit(state: string) {
    this.state = state;
    this.listeners.forEach((fn) => fn(state));
  }
}

class MockSession {
  state = 'Initial';
  invite = vi.fn(async () => undefined);
  bye = vi.fn(async () => undefined);
  sessionDescriptionHandler: {
    peerConnection: {
      addEventListener: (type: string, fn: (event: unknown) => void) => void;
      getStats: () => Promise<Map<string, unknown>>;
    };
  };
  private readonly trackListeners: Array<
    (event: { transceiver?: { mid?: string | null }; track: MediaStreamTrack }) => void
  > = [];
  private listeners: StateListener<string>[] = [];
  stateChange = {
    addListener: (fn: StateListener<string>) => {
      this.listeners.push(fn);
    },
  };

  constructor() {
    const trackListeners = this.trackListeners;
    this.sessionDescriptionHandler = {
      peerConnection: {
        addEventListener: (type, fn) => {
          if (type === 'track') {
            trackListeners.push(
              fn as (event: { transceiver?: { mid?: string | null }; track: MediaStreamTrack }) => void,
            );
          }
        },
        getStats: async () => new Map(),
      },
    };
  }

  emit(state: string) {
    this.state = state;
    this.listeners.forEach((fn) => fn(state));
  }

  emitTrack(mid: string, track: MediaStreamTrack) {
    this.trackListeners.forEach((fn) => fn({ transceiver: { mid }, track }));
  }
}

let lastRegisterer: MockRegisterer;
let lastSession: MockSession;

vi.mock('sip.js', () => ({
  UserAgent: Object.assign(
    class UserAgent {
      static makeURI(value: string) {
        return { uri: value };
      }

      constructor(options: unknown) {
        uaCtor(options);
      }

      start = vi.fn(async () => undefined);
      stop = vi.fn(async () => undefined);
    },
    { makeURI: (value: string) => ({ uri: value }) },
  ),
  Registerer: class Registerer {
    constructor(...args: unknown[]) {
      registererCtor(...args);
      lastRegisterer = new MockRegisterer();
      Object.assign(this, lastRegisterer);
      return lastRegisterer;
    }
  },
  Inviter: class Inviter {
    constructor(...args: unknown[]) {
      inviterCtor(...args);
      lastSession = new MockSession();
      Object.assign(this, lastSession);
      return lastSession;
    }
  },
  RegistererState: {
    Registered: 'Registered',
    Unregistered: 'Unregistered',
  },
  SessionState: {
    Initial: 'Initial',
    Establishing: 'Establishing',
    Established: 'Established',
    Terminated: 'Terminated',
  },
  Web: {
    defaultSessionDescriptionHandlerFactory: () => () => ({}),
  },
}));

import { useConferenceRoom } from './useConferenceRoom';

const COMPANION = {
  roomUid: 77,
  roomNumber: '6001',
  sipId: 'ew101',
  sipPassword: 'secret',
  sipDomain: 'pbx.example',
  wssUrl: 'wss://pbx.example/ws',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function fakeTrack(id: string, kind: 'audio' | 'video' = 'video'): MediaStreamTrack {
  return {
    id,
    kind,
    readyState: 'live',
    label: id,
    enabled: true,
    muted: false,
    stop() {
      this.readyState = 'ended';
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  } as unknown as MediaStreamTrack;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function establishRoom(
  result: { current: ReturnType<typeof useConferenceRoom> },
  tracks?: Array<{ mid: string; track: MediaStreamTrack }>,
) {
  await flush();
  expect(lastRegisterer).toBeDefined();
  await act(async () => {
    lastRegisterer.emit('Registered');
    await Promise.resolve();
  });
  expect(lastSession).toBeDefined();
  await act(async () => {
    lastSession.emit('Established');
    await Promise.resolve();
  });
  if (tracks) {
    act(() => {
      for (const item of tracks) {
        lastSession.emitTrack(item.mid, item.track);
      }
    });
  }
  lastSession.invite.mockClear();
}

describe('useConferenceRoom (16.3-02 R-RENEG)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uaCtor.mockClear();
    registererCtor.mockClear();
    inviterCtor.mockClear();
    lastRegisterer = undefined as unknown as MockRegisterer;
    lastSession = undefined as unknown as MockSession;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not start a UA when there is no WebRTC companion', () => {
    const { result } = renderHook(() =>
      useConferenceRoom({
        roomUid: 77,
        roomNumber: '6001',
      }),
    );
    expect(result.current.error).toBe('noWebrtcCompanion');
    expect(uaCtor).not.toHaveBeenCalled();
  });

  it('constructs UserAgent with conferenceSdhFactory and max-bundle', async () => {
    renderHook(() => useConferenceRoom(COMPANION));
    await flush();
    expect(uaCtor).toHaveBeenCalled();
    const options = uaCtor.mock.calls[0][0] as {
      sessionDescriptionHandlerFactory: unknown;
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: unknown; video: unknown };
        iceGatheringTimeout: number;
        peerConnectionConfiguration: { bundlePolicy: string };
      };
      reconnectionAttempts: number;
      transportOptions: { keepAliveInterval: number };
    };
    expect(typeof options.sessionDescriptionHandlerFactory).toBe('function');
    expect(options.sessionDescriptionHandlerFactory).not.toBe(conferenceSdhFactory);
    expect(options.sessionDescriptionHandlerFactoryOptions.peerConnectionConfiguration.bundlePolicy).toBe(
      'max-bundle',
    );
    expect(options.sessionDescriptionHandlerFactoryOptions.constraints.video).toBe(true);
    expect(options.sessionDescriptionHandlerFactoryOptions.constraints.audio).toBeTruthy();
    expect(options.sessionDescriptionHandlerFactoryOptions.iceGatheringTimeout).toBe(2000);
    expect(options.reconnectionAttempts).toBe(10);
    expect(options.transportOptions.keepAliveInterval).toBe(20);
    expect(JSON.stringify(options)).not.toMatch(/VIDEO_SLOTS/);
    const sdh = (options.sessionDescriptionHandlerFactory as (session: unknown, opts: unknown) => unknown)(
      { userAgent: { getLogger: () => ({ debug() {}, error() {}, warn() {}, log() {} }) } },
      {},
    );
    expect(sdh).toEqual(expect.any(Object));
    expect(typeof sdh).not.toBe('function');
  });

  it('waits for RegistererState.Registered via stateChange before INVITE', async () => {
    renderHook(() => useConferenceRoom(COMPANION));
    await flush();
    expect(lastRegisterer.register).toHaveBeenCalled();
    expect(inviterCtor).not.toHaveBeenCalled();
    await act(async () => {
      lastRegisterer.emit('Registered');
      await Promise.resolve();
    });
    expect(inviterCtor).toHaveBeenCalled();
    const target = inviterCtor.mock.calls[0][1] as { uri: string };
    expect(target.uri).toContain('6001');
  });

  it('invites guest exten s when inviteExten is set and roomNumber is empty', async () => {
    renderHook(() =>
      useConferenceRoom({
        ...COMPANION,
        roomNumber: '',
        inviteExten: 's',
      }),
    );
    await flush();
    await act(async () => {
      lastRegisterer.emit('Registered');
      await Promise.resolve();
    });
    const target = inviterCtor.mock.calls[0][1] as { uri: string };
    expect(target.uri).toContain('sip:s@');
    expect(target.uri).not.toContain('sip:@');
  });

  it('does not INVITE when both roomNumber and inviteExten are empty', async () => {
    renderHook(() =>
      useConferenceRoom({
        ...COMPANION,
        roomNumber: '',
      }),
    );
    await flush();
    await act(async () => {
      lastRegisterer.emit('Registered');
      await Promise.resolve();
    });
    expect(inviterCtor).not.toHaveBeenCalled();
  });

  it('does not flag videoFailed when local camera is live and SFU has no remote frames', async () => {
    const local = fakeTrack('cam');
    const localStream = {
      getTracks: () => [local],
      getVideoTracks: () => [local],
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    const { result } = renderHook(() =>
      useConferenceRoom({
        ...COMPANION,
        localStream,
      }),
    );
    await establishRoom(result, [{ mid: '1', track: fakeTrack('remote-empty') }]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.videoFailedMids).toEqual([]);
    expect(lastSession.invite).not.toHaveBeenCalled();
  });

  it('auto re-INVITEs after remote Terminated', async () => {
    const { result } = renderHook(() => useConferenceRoom(COMPANION));
    await establishRoom(result);
    inviterCtor.mockClear();
    await act(async () => {
      lastSession.emit('Terminated');
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(inviterCtor).toHaveBeenCalledTimes(1);
  });

  it('does not renegotiate before the 4000ms watchdog', async () => {
    const { result } = renderHook(() => useConferenceRoom(COMPANION));
    await establishRoom(result, [{ mid: '1', track: fakeTrack('v1') }]);
    expect(lastSession.invite).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3999);
    });
    expect(lastSession.invite).not.toHaveBeenCalled();
  });

  it('renegotiates at most twice then flags videoFailed', async () => {
    const { result } = renderHook(() => useConferenceRoom(COMPANION));
    await establishRoom(result, [{ mid: '1', track: fakeTrack('v1') }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(lastSession.invite).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(lastSession.invite).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(lastSession.invite).toHaveBeenCalledTimes(2);
    expect(result.current.videoFailedMids).toContain('1');
    expect(result.current.remoteTracks['1']).toBeDefined();
  });

  it('keeps previously attached mid tiles when the second invite fails', async () => {
    const { result } = renderHook(() => useConferenceRoom(COMPANION));
    const first = fakeTrack('v1');
    const second = fakeTrack('v2');
    await establishRoom(result, [
      { mid: '1', track: first },
      { mid: '2', track: second },
    ]);

    lastSession.invite.mockResolvedValueOnce(undefined);
    lastSession.invite.mockRejectedValueOnce(new Error('reneg failed'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(lastSession.invite).toHaveBeenCalledTimes(2);
    expect(result.current.remoteTracks['1']).toBe(first);
    expect(result.current.remoteTracks['2']).toBe(second);
  });

  it('calls session.bye on pagehide', async () => {
    const { result } = renderHook(() => useConferenceRoom(COMPANION));
    await establishRoom(result);
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(lastSession.bye).toHaveBeenCalled();
  });

  it('unregisters the live softphone AOR for the room and restores on leave', async () => {
    const unregisterSoftphone = vi.fn();
    const restoreSoftphone = vi.fn();
    const { result } = renderHook(() =>
      useConferenceRoom({
        ...COMPANION,
        liveSoftphoneAor: 'ew101',
        unregisterSoftphone,
        restoreSoftphone,
      }),
    );
    await flush();
    expect(unregisterSoftphone).toHaveBeenCalled();
    await act(async () => {
      await result.current.leave();
    });
    expect(restoreSoftphone).toHaveBeenCalled();
  });
});
