import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rtkApi } from '@/shared/api/rtkApi';
import {
  conferenceRoomApi,
  type ConferenceRoom,
} from '@/shared/api/endpoints/conferenceRoomApi';

import { useConferenceSse } from './useConferenceSse';
import conferenceSessionReducer from '../model/slice/conferenceSessionSlice';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
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
    (this.listeners[type] || []).forEach((fn) => fn(evt));
  }
}

const roomStub = (over: Partial<ConferenceRoom> = {}): ConferenceRoom => ({
  uid: 77,
  number: '6001',
  name: 'Standup',
  kind: 'permanent',
  entry_strictness: 'token_name',
  pin: null,
  wait_marked: false,
  end_marked: false,
  record_mode: 'off',
  notify_recording: true,
  invite_external_scope: 'owner',
  tariff_max_participants: null,
  musiconhold: null,
  announce_join_leave: false,
  participants: [],
  waitingForModerator: false,
  recording: false,
  ...over,
});

function makeStore() {
  return configureStore({
    reducer: {
      conferenceSession: conferenceSessionReducer,
      [rtkApi.reducerPath]: rtkApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(rtkApi.middleware),
  });
}

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store } as never, children);

function cachedRoom(store: ReturnType<typeof makeStore>, uid: number) {
  return conferenceRoomApi.endpoints.getConferenceRoom.select(uid)(store.getState()).data;
}

describe('useConferenceSse (16.3-02)', () => {
  let originalES: typeof EventSource | undefined;

  beforeEach(() => {
    originalES = (globalThis as { EventSource?: typeof EventSource }).EventSource;
    (globalThis as { EventSource: typeof EventSource }).EventSource =
      MockEventSource as unknown as typeof EventSource;
    MockEventSource.instances = [];
    localStorage.setItem('accessToken', 'staff-jwt');
  });

  afterEach(() => {
    (globalThis as { EventSource?: typeof EventSource }).EventSource = originalES;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens staff EventSource on /conferences/:room_uid/events?token=', () => {
    const store = makeStore();
    renderHook(
      () => useConferenceSse({ mode: 'staff', roomUid: 77 }),
      { wrapper: wrapper(store) },
    );
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toMatch(/\/conferences\/77\/events\?token=/);
    expect(MockEventSource.instances[0].url).toContain('token=staff-jwt');
    expect(MockEventSource.instances[0].url).not.toMatch(/password/i);
  });

  it('opens guest EventSource on /conferences/guest/:token/events?token=', () => {
    const store = makeStore();
    renderHook(
      () => useConferenceSse({ mode: 'guest', roomUid: 77, token: 'guest-opaque' }),
      { wrapper: wrapper(store) },
    );
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toMatch(
      /\/conferences\/guest\/guest-opaque\/events\?token=/,
    );
    expect(MockEventSource.instances[0].url).toContain('token=guest-opaque');
    expect(MockEventSource.instances[0].url).not.toMatch(/password/i);
  });

  it('patches getConferenceRoom participants via updateQueryData on snapshot', () => {
    const store = makeStore();
    store.dispatch(conferenceRoomApi.util.upsertQueryData('getConferenceRoom', 77, roomStub()));
    expect(cachedRoom(store, 77)?.participants).toEqual([]);

    renderHook(
      () => useConferenceSse({ mode: 'staff', roomUid: 77 }),
      { wrapper: wrapper(store) },
    );

    act(() => {
      MockEventSource.instances[0].emit('fullSnapshot', {
        participants: [
          {
            ref: 'ew101',
            displayName: 'Alice',
            role: 'moderator',
            speaking: false,
            muted: false,
            video: true,
          },
        ],
        waitingForModerator: false,
        recording: true,
      });
    });

    const room = cachedRoom(store, 77);
    expect(room?.participants).toHaveLength(1);
    expect(room?.participants?.[0].ref).toBe('ew101');
    expect(room?.recording).toBe(true);
    expect(store.getState().conferenceSession.roomUid).toBeNull();
  });
});
