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

const makeStore = () =>
  configureStore({ reducer: { callCenter: callCenterReducer } });

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store } as any, children);

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
    const c = store.getState().callCenter.calls.find(c => c.uniqueid === 'u1');
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
});
