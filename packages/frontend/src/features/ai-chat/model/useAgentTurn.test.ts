import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { rtkApi } from '@/shared/api/rtkApi';
import { aiChatApi } from '@/shared/api/endpoints/aiChatApi';
import { clearLiveTimelines } from '@/shared/api/endpoints/aiChatLiveTimeline';
import { aiChatReducer } from './slice/aiChatSlice';
import { useAgentTurn } from './useAgentTurn';

const AT = '2026-09-08T10:00:00.000Z';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

function encodeSse(events: Array<{ event: string; data: unknown }>): Uint8Array {
  const text = events
    .map((item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`)
    .join('');
  return new TextEncoder().encode(text);
}

function mockFetchStream(chunks: Uint8Array[], options?: { failAfter?: number }) {
  let index = 0;
  const reader = {
    read: vi.fn(async () => {
      if (options?.failAfter != null && index >= options.failAfter) {
        throw new TypeError('network error');
      }
      if (index >= chunks.length) return { done: true, value: undefined };
      const value = chunks[index];
      index += 1;
      return { done: false, value };
    }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { getReader: () => reader },
    })),
  );
  return reader;
}

function emptyThread(uid = 7) {
  return {
    uid,
    title: 'Test',
    status: 'active' as const,
    last_message_at: null,
    created_at: AT,
    updated_at: AT,
    timeline: [] as never[],
    cards: {},
  };
}

function makeStore() {
  const store = configureStore({
    reducer: {
      aiChat: aiChatReducer,
      [rtkApi.reducerPath]: rtkApi.reducer,
    },
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(rtkApi.middleware),
  });
  store.dispatch(aiChatApi.util.upsertQueryData('getAiChatThread', 7, emptyThread(7)));
  return store;
}

function wrapperFor(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

function selectTimeline(store: ReturnType<typeof makeStore>, uid = 7) {
  return aiChatApi.endpoints.getAiChatThread.select(uid)(store.getState()).data?.timeline ?? [];
}

const FIXTURE_TURN = [
  { event: 'thread', data: { uid: 7 } },
  { event: 'item', data: { kind: 'user', id: 'm1', text: 'Как очереди?', createdAt: AT } },
  { event: 'item', data: { kind: 'step', id: 's1', labelKey: 'aiChat.progress.tools.list_queues', labelFallback: 'list_queues', done: false, createdAt: AT } },
  { event: 'item', data: { kind: 'step', id: 's1', labelKey: 'aiChat.progress.tools.list_queues', labelFallback: 'list_queues', done: true, createdAt: AT } },
  { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'Очереди ', closeKind: 'complete', streaming: true, createdAt: AT } },
  { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'Очереди в порядке.', closeKind: 'complete', streaming: false, createdAt: AT } },
  { event: 'done', data: { closeKind: 'complete' } },
];

describe('useAgentTurn', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.setItem('accessToken', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    clearLiveTimelines();
  });

  it('upserts items into the thread cache instead of a local list', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('Как очереди?');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    const timeline = selectTimeline(store, 7);
    expect(timeline).toHaveLength(3);
    expect(timeline.map((row) => row.kind)).toEqual(['user', 'step', 'assistant']);
    const step = timeline.find((row) => row.kind === 'step');
    expect(step && step.kind === 'step' && step.done).toBe(true);
    expect(store.getState().aiChat).not.toHaveProperty('messages');
  });

  it('accumulates the assistant bubble under one id', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('Как очереди?');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    const assistants = selectTimeline(store, 7).filter((row) => row.kind === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]).toMatchObject({ id: 'a1', text: 'Очереди в порядке.', streaming: false });
  });

  it('marks the ceiling as its own outcome', async () => {
    mockFetchStream([
      encodeSse([
        { event: 'thread', data: { uid: 7 } },
        { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'I looked at three tools', closeKind: 'complete', streaming: true, createdAt: AT } },
        { event: 'error', data: { code: 'max_steps_exceeded', message: 'Step ceiling reached', maxSteps: 12 } },
      ]),
    ]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('do everything');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('ceiling');
    });

    expect(result.current.outcome).not.toBe('stopped');
    expect(result.current.outcome).not.toBe('failed');
    expect(result.current.isStreaming).toBe(false);
  });

  it('keeps the partial timeline and reports disconnect when the stream drops', async () => {
    mockFetchStream(
      [encodeSse([
        { event: 'thread', data: { uid: 7 } },
        { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'partial answer so far', closeKind: 'complete', streaming: true, createdAt: AT } },
      ])],
      { failAfter: 1 },
    );
    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('status');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('disconnected');
    });

    const timeline = selectTimeline(store, 7);
    expect(timeline.some((row) => row.kind === 'assistant' && row.text === 'partial answer so far')).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.outcome).not.toBe('done');
    expect(result.current.outcome).not.toBe('failed');
  });

  it('ignores items after stop', async () => {
    let releaseSecond: ((value: { done: boolean; value?: Uint8Array }) => void) | undefined;
    const secondRead = new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
      releaseSecond = resolve;
    });
    let reads = 0;
    const reader = {
      read: vi.fn(async () => {
        reads += 1;
        if (reads === 1) {
          return {
            done: false,
            value: encodeSse([
              { event: 'thread', data: { uid: 7 } },
              { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'partial ', closeKind: 'complete', streaming: true, createdAt: AT } },
            ]),
          };
        }
        return secondRead;
      }),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
      })),
    );

    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('long turn');
    });

    await waitFor(() => {
      expect(selectTimeline(store, 7).some((row) => row.kind === 'assistant' && row.text === 'partial ')).toBe(true);
    });

    await act(async () => {
      result.current.stop();
    });

    expect(result.current.outcome).toBe('stopped');
    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      releaseSecond?.({
        done: false,
        value: encodeSse([
          { event: 'item', data: { kind: 'assistant', id: 'a1', text: 'should not appear', closeKind: 'complete', streaming: false, createdAt: AT } },
          { event: 'done', data: { closeKind: 'complete' } },
        ]),
      });
    });

    const assistants = selectTimeline(store, 7).filter((row) => row.kind === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]).toMatchObject({ text: 'partial ' });
    expect(JSON.stringify(selectTimeline(store, 7))).not.toContain('should not appear');
    expect(result.current.outcome).toBe('stopped');
  });

  it('keeps continue upserts when a shorter GET replaces the thread cache', async () => {
    const prior = [
      { kind: 'user' as const, id: 'm1', text: 'apply this', createdAt: AT },
      { kind: 'proposal' as const, id: 'p1', card: 'single' as const, createdAt: AT },
    ];
    const staleThread = { ...emptyThread(7), timeline: prior };
    const continueChunk = encodeSse([
      { event: 'item', data: { kind: 'assistant', id: 'a-live', text: 'applied, next step', closeKind: 'complete', streaming: false, createdAt: AT } },
      { event: 'done', data: { closeKind: 'complete' } },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') {
          let index = 0;
          return {
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: async () => {
                  if (index >= 1) return { done: true, value: undefined };
                  index += 1;
                  return { done: false, value: continueChunk };
                },
              }),
            },
          };
        }
        const body = JSON.stringify(staleThread);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => staleThread,
          text: async () => body,
          clone() {
            return this;
          },
        };
      }),
    );

    const store = configureStore({
      reducer: {
        aiChat: aiChatReducer,
        [rtkApi.reducerPath]: rtkApi.reducer,
      },
      middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(rtkApi.middleware),
    });
    store.dispatch(aiChatApi.endpoints.getAiChatThread.initiate(7));
    await waitFor(() => {
      expect(selectTimeline(store, 7).map((row) => row.id)).toEqual(['m1', 'p1']);
    });

    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.continueAfterApply();
    });

    await waitFor(() => {
      expect(selectTimeline(store, 7).map((row) => row.id)).toEqual(['m1', 'p1', 'a-live']);
    });

    await act(async () => {
      store.dispatch(aiChatApi.util.invalidateTags([{ type: 'AiChatThreads', id: 7 }]));
    });

    await waitFor(() => {
      expect(selectTimeline(store, 7).map((row) => row.id)).toEqual(['m1', 'p1', 'a-live']);
    });
  });

  it('continueAfterApply posts to the continue endpoint with an empty body', async () => {
    mockFetchStream([encodeSse([{ event: 'done', data: { closeKind: 'complete' } }])]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentTurn({ threadUid: 7 }), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.continueAfterApply();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai-chat/threads/7/continue'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body ?? '{}'))).toEqual({});
  });

  it('never puts a locale string into the model prompt', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/ai-chat/model/useAgentTurn.ts'), 'utf8');
    expect(src).not.toMatch(/continueAfterApply'\)/);
  });
});
