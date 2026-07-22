import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import callCenterReducer from '../model/slice/callCenterSlice';
import type { NotificationMatrix } from '@/shared/api/endpoints/callCenterApi';
import {
  getEffectiveChannels,
  isChannelEnabled,
  isEventLocked,
  useCallCenterNotifications,
} from './useCallCenterNotifications';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

// ─── Pure decision function (D-41/D-42/D-43) ────────────────────────────────

describe('isEventLocked', () => {
  it('is false when locks has no entry for the event', () => {
    expect(isEventLocked('incoming_call', {})).toBe(false);
  });

  it('is false when locks has an empty array for the event', () => {
    expect(isEventLocked('incoming_call', { incoming_call: [] })).toBe(false);
  });

  it('is true when locks has a non-empty array for the event', () => {
    expect(isEventLocked('incoming_call', { incoming_call: ['sound'] })).toBe(true);
  });
});

describe('getEffectiveChannels', () => {
  const defaults: NotificationMatrix = { incoming_call: ['sound', 'popup'], chat_message: ['chat'] };

  it('uses the operator matrix value when the event is not locked', () => {
    const matrix: NotificationMatrix = { incoming_call: ['sound'] };
    expect(getEffectiveChannels('incoming_call', matrix, {}, defaults)).toEqual(['sound']);
  });

  it('falls back to the tenant default when unlocked and the operator has no entry', () => {
    expect(getEffectiveChannels('incoming_call', {}, {}, defaults)).toEqual(['sound', 'popup']);
  });

  it('ignores the operator matrix entirely when the event is locked, using the default instead', () => {
    // Stale operator override predating the lock — must never leak through.
    const matrix: NotificationMatrix = { incoming_call: ['chat', 'sound', 'popup'] };
    const locks: NotificationMatrix = { incoming_call: ['sound'] };
    expect(getEffectiveChannels('incoming_call', matrix, locks, defaults)).toEqual(['sound', 'popup']);
  });

  it('returns an empty array when locked and the tenant default has no channels for the event', () => {
    const matrix: NotificationMatrix = { chat_message: ['chat', 'sound'] };
    const locks: NotificationMatrix = { chat_message: ['sound'] };
    const defaultsNoChat: NotificationMatrix = {};
    expect(getEffectiveChannels('chat_message', matrix, locks, defaultsNoChat)).toEqual([]);
  });
});

describe('isChannelEnabled', () => {
  it('reflects the effective channel set, not the raw operator matrix, when locked', () => {
    const matrix: NotificationMatrix = { missed_call: ['sound', 'popup'] };
    const locks: NotificationMatrix = { missed_call: ['sound'] };
    const defaults: NotificationMatrix = { missed_call: ['popup'] };
    expect(isChannelEnabled('missed_call', 'sound', matrix, locks, defaults)).toBe(false);
    expect(isChannelEnabled('missed_call', 'popup', matrix, locks, defaults)).toBe(true);
  });
});

// ─── Hook integration (behavior block) ──────────────────────────────────────

type AuthUser = { uniqueid: number; login: string; name: string; level: number; role: number; exten: string; vpbx_user_uid: number };

const currentUser: AuthUser = {
  uniqueid: 42, login: 'agent', name: 'Agent', level: 2, role: 0, exten: '110', vpbx_user_uid: 1,
};

const makeStore = (opts?: {
  myAgentInterface?: string | null;
  agents?: any[];
  calls?: any[];
}) =>
  configureStore({
    reducer: {
      callCenter: callCenterReducer,
      auth: (state = {
        user: currentUser, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false, error: null,
      }) => state,
    } as any,
    preloadedState: {
      callCenter: {
        agents: opts?.agents ?? [{
          interface: 'PJSIP/101', name: 'Agent', status: 'READY',
          queues: ['sales'], callsTaken: 0, userUid: 1, userId: 42,
        }],
        queues: [],
        calls: opts?.calls ?? [],
        connected: true,
        myAgentInterface: opts?.myAgentInterface ?? 'PJSIP/101',
        chatUnreadByChannel: {},
        chatOpen: false,
      },
    } as any,
  });

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store } as any, children);

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'running';
  currentTime = 0;
  constructor() { MockAudioContext.instances.push(this); }
  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect: () => ({ connect: () => {} }), start: () => {}, stop: () => {} };
  }
  createGain() {
    return { gain: { value: 0, exponentialRampToValueAtTime: () => {} }, connect: () => ({ connect: () => {} }) };
  }
  resume() { return Promise.resolve(); }
}

describe('useCallCenterNotifications', () => {
  let originalAudioContext: any;

  beforeEach(() => {
    originalAudioContext = (window as any).AudioContext;
    MockAudioContext.instances = [];
    (window as any).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
    vi.restoreAllMocks();
  });

  it('plays a sound cue for incoming_call when sound is in the effective matrix', () => {
    const store = makeStore();
    const matrix: NotificationMatrix = { incoming_call: ['sound'] };
    renderHook(
      () => useCallCenterNotifications({ matrix, locks: {}, defaults: {}, volume: 0.1 }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      store.dispatch({ type: 'callCenter/addCall', payload: {
        uniqueid: 'w1', callerIdNum: '111', callerIdName: '', queue: 'sales', status: 'WAITING',
        enterTime: new Date().toISOString(), holdTime: 0, talkTime: 0, userUid: 1,
      } });
    });

    expect(MockAudioContext.instances).toHaveLength(1);
  });

  it('never plays a sound cue for a locked-off event, even if the operator matrix requests it', () => {
    const store = makeStore();
    // Operator's own (stale) preference asks for sound, but the tenant lock forces the
    // (empty) default — the effective channel set must be empty regardless.
    const matrix: NotificationMatrix = { incoming_call: ['sound'] };
    const locks: NotificationMatrix = { incoming_call: ['sound'] };
    const defaults: NotificationMatrix = {};
    renderHook(
      () => useCallCenterNotifications({ matrix, locks, defaults, volume: 0.1 }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      store.dispatch({ type: 'callCenter/addCall', payload: {
        uniqueid: 'w2', callerIdNum: '111', callerIdName: '', queue: 'sales', status: 'WAITING',
        enterTime: new Date().toISOString(), holdTime: 0, talkTime: 0, userUid: 1,
      } });
    });

    expect(MockAudioContext.instances).toHaveLength(0);
  });

  it('does not play a sound cue when the effective matrix has no sound channel for the event', () => {
    const store = makeStore();
    const matrix: NotificationMatrix = { incoming_call: ['popup'] };
    renderHook(
      () => useCallCenterNotifications({ matrix, locks: {}, defaults: {}, volume: 0.1 }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      store.dispatch({ type: 'callCenter/addCall', payload: {
        uniqueid: 'w3', callerIdNum: '111', callerIdName: '', queue: 'sales', status: 'WAITING',
        enterTime: new Date().toISOString(), holdTime: 0, talkTime: 0, userUid: 1,
      } });
    });

    expect(MockAudioContext.instances).toHaveLength(0);
  });

  it('dispatches a cc:notification-chat event for chat_message when the chat channel is enabled', () => {
    const store = makeStore();
    const matrix: NotificationMatrix = { chat_message: ['chat'] };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHook(
      () => useCallCenterNotifications({ matrix, locks: {}, defaults: {} }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('cc:chat-message', {
        detail: { uid: 1, channel_key: 'k', channel_type: 'direct', sender_user_id: 99, sender_name: 'Bob', body: 'hi', created_at: '' },
      }));
    });

    expect(dispatchSpy.mock.calls.some((call) => (call[0] as CustomEvent).type === 'cc:notification-chat')).toBe(true);
  });

  it('ignores chat messages sent by the current operator (no self-notification)', () => {
    const store = makeStore();
    const matrix: NotificationMatrix = { chat_message: ['chat'] };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHook(
      () => useCallCenterNotifications({ matrix, locks: {}, defaults: {} }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('cc:chat-message', {
        detail: { uid: 2, channel_key: 'k', channel_type: 'direct', sender_user_id: currentUser.uniqueid, sender_name: 'Me', body: 'hi', created_at: '' },
      }));
    });

    expect(dispatchSpy.mock.calls.some((call) => (call[0] as CustomEvent).type === 'cc:notification-chat')).toBe(false);
  });
});
