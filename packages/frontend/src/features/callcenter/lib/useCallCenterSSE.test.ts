import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import callCenterReducer from '../model/slice/callCenterSlice';
import { useCallCenterSSE } from './useCallCenterSSE';

/**
 * Mock EventSource that lets us drive the test by emitting events
 * the same way the backend would.
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(fn);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    (this.listeners[type] || []).forEach(fn => fn(evt));
  }
  triggerOpen() {
    this.onopen?.(new Event('open'));
  }
}

type AuthUser = { uniqueid: number; login: string; name: string; level: number; role: number; exten: string; vpbx_user_uid: number };

const makeStore = (opts?: { user?: AuthUser | null; myAgentInterface?: string | null }) =>
  configureStore({
    reducer: {
      callCenter: callCenterReducer,
      auth: (state = {
        user: opts?.user ?? null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }) => state,
    } as any,
    preloadedState: opts?.myAgentInterface !== undefined
      ? {
          callCenter: {
            agents: [],
            queues: [],
            calls: [],
            connected: false,
            myAgentInterface: opts.myAgentInterface,
            chatUnreadByChannel: {},
            chatOpen: false,
          },
        } as any
      : undefined,
  });

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store } as any, children);

const currentUser: AuthUser = {
  uniqueid: 42,
  login: 'agent',
  name: 'Agent',
  level: 2,
  role: 0,
  exten: '110',
  vpbx_user_uid: 1,
};

describe('useCallCenterSSE', () => {
  let originalES: any;
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    originalES = (globalThis as any).EventSource;
    (globalThis as any).EventSource = MockEventSource;
    MockEventSource.instances = [];
    localStorage.setItem('accessToken', 'fake-token');
    store = makeStore();
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalES;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not connect when no token is present', () => {
    localStorage.removeItem('accessToken');
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not connect when disabled', () => {
    renderHook(() => useCallCenterSSE(false), { wrapper: wrapper(store) });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('opens an EventSource with the token in the query string', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('token=fake-token');
  });

  it('marks the slice as connected on the open event', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => MockEventSource.instances[0].triggerOpen());
    expect(store.getState().callCenter.connected).toBe(true);
  });

  it('dispatches setSnapshot on fullSnapshot event', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('fullSnapshot', {
        agents: [{
          interface: 'PJSIP/101', name: 'A', status: 'READY',
          queues: [], callsTaken: 0, userUid: 1, userId: 1,
        }],
        queues: [],
        calls: [],
      });
    });
    expect(store.getState().callCenter.agents).toHaveLength(1);
    expect(store.getState().callCenter.connected).toBe(true);
  });

  it('translates callAnswer into updateCall(TALKING)', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    // Seed a call so we can patch it
    act(() => {
      MockEventSource.instances[0].emit('callNew', {
        uniqueid: 'u1', callerIdNum: '111', callerIdName: '',
        queue: 'sales', status: 'WAITING',
        enterTime: '2026-01-01', holdTime: 0, talkTime: 0, userUid: 1,
      });
    });
    act(() => {
      MockEventSource.instances[0].emit('callAnswer', { uniqueid: 'u1', agent: 'PJSIP/101' });
    });
    const c = store.getState().callCenter.calls.find(
      (call: { uniqueid: string }) => call.uniqueid === 'u1',
    );
    expect(c?.status).toBe('TALKING');
    expect(c?.agent).toBe('PJSIP/101');
  });

  it('removes call on callEnd / callAbandon', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('callNew', {
        uniqueid: 'u1', callerIdNum: '111', callerIdName: '',
        queue: 'sales', status: 'WAITING',
        enterTime: '2026-01-01', holdTime: 0, talkTime: 0, userUid: 1,
      });
    });
    act(() => MockEventSource.instances[0].emit('callEnd', { uniqueid: 'u1' }));
    expect(store.getState().callCenter.calls).toHaveLength(0);

    act(() => {
      MockEventSource.instances[0].emit('callNew', {
        uniqueid: 'u2', callerIdNum: '222', callerIdName: '',
        queue: 'sales', status: 'WAITING',
        enterTime: '2026-01-01', holdTime: 0, talkTime: 0, userUid: 1,
      });
    });
    act(() => MockEventSource.instances[0].emit('callAbandon', { uniqueid: 'u2' }));
    expect(store.getState().callCenter.calls).toHaveLength(0);
  });

  it('flips agent to WRAPUP / READY on wrapup events', () => {
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('fullSnapshot', {
        agents: [{
          interface: 'PJSIP/101', name: 'A', status: 'IN_CALL',
          queues: [], callsTaken: 0, userUid: 1, userId: 1,
        }],
        queues: [], calls: [],
      });
    });
    act(() => MockEventSource.instances[0].emit('wrapupStart', { agent: 'PJSIP/101' }));
    expect(store.getState().callCenter.agents[0].status).toBe('WRAPUP');
    act(() => MockEventSource.instances[0].emit('wrapupEnd', { agent: 'PJSIP/101' }));
    expect(store.getState().callCenter.agents[0].status).toBe('READY');
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
    expect(store.getState().callCenter.connected).toBe(false);
  });

  it('binds myAgentInterface from fullSnapshot when null and agent.userId matches current user', () => {
    store = makeStore({ user: currentUser, myAgentInterface: null });
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('fullSnapshot', {
        agents: [{
          interface: 'PJSIP/e110', name: 'Agent', status: 'READY',
          queues: ['sales'], callsTaken: 0, userUid: 1, userId: 42,
        }],
        queues: [],
        calls: [],
      });
    });
    expect(store.getState().callCenter.myAgentInterface).toBe('PJSIP/e110');
  });

  it('binds myAgentInterface from agentUpdate when null and agent.userId matches', () => {
    store = makeStore({ user: currentUser, myAgentInterface: null });
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('agentUpdate', {
        interface: 'PJSIP/ew110', name: 'Agent', status: 'READY',
        queues: ['sales'], callsTaken: 0, userUid: 1, userId: 42,
      });
    });
    expect(store.getState().callCenter.myAgentInterface).toBe('PJSIP/ew110');
  });

  it('does not overwrite an existing myAgentInterface via SSE fallback', () => {
    store = makeStore({ user: currentUser, myAgentInterface: 'PJSIP/e110' });
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('agentUpdate', {
        interface: 'PJSIP/ew999', name: 'Other', status: 'READY',
        queues: [], callsTaken: 0, userUid: 1, userId: 42,
      });
    });
    expect(store.getState().callCenter.myAgentInterface).toBe('PJSIP/e110');
  });

  it('does not bind myAgentInterface for OFFLINE matching agent', () => {
    store = makeStore({ user: currentUser, myAgentInterface: null });
    renderHook(() => useCallCenterSSE(true), { wrapper: wrapper(store) });
    act(() => {
      MockEventSource.instances[0].emit('agentUpdate', {
        interface: 'PJSIP/e110', name: 'Agent', status: 'OFFLINE',
        queues: [], callsTaken: 0, userUid: 1, userId: 42,
      });
    });
    expect(store.getState().callCenter.myAgentInterface).toBeNull();
  });
});
