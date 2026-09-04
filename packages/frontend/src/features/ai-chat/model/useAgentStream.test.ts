import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { aiChatReducer } from './slice/aiChatSlice';
import { useAgentStream } from './useAgentStream';

const tMock = vi.fn((key: string) => {
  const phrases: Record<string, string> = {
    'aiChat.progress.tools.get_pbx_state': 'Reading the PBX state',
    'aiChat.progress.working': 'Working on the next step',
    'aiChat.stopped': 'Stopped',
    'aiChat.ceiling': 'Step limit reached. Narrow the task or start a new chat.',
    'aiChat.failed': 'Could not get a reply. Check the network and retry.',
    'aiChat.disconnected': 'Connection lost. Reconnect to continue.',
    'aiChat.reconnect': 'Reconnect',
  };
  return phrases[key] ?? key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
    i18n: { language: 'en' },
  }),
}));

const BULKY_TOOL_RESULT =
  '{"queues":[{"uid":1,"name":"sales","members":["a","b","c"],"secret":"SHOULD_NOT_RENDER_RAW_QUEUE_DUMP"}]}';

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

function makeStore() {
  return configureStore({
    reducer: { aiChat: aiChatReducer },
  });
}

function wrapperFor(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

const FIXTURE_TURN = [
  { event: 'progress', data: { tool: 'get_pbx_state', label: 'Running get_pbx_state' } },
  { event: 'tool_call', data: { name: 'get_pbx_state', arguments: '{}' } },
  { event: 'tool_result', data: { name: 'get_pbx_state', result: BULKY_TOOL_RESULT } },
  { event: 'progress', data: { tool: 'unknown_custom_tool', label: 'Running unknown_custom_tool' } },
  { event: 'tool_call', data: { name: 'unknown_custom_tool', arguments: '{}' } },
  { event: 'tool_result', data: { name: 'unknown_custom_tool', result: BULKY_TOOL_RESULT } },
  { event: 'text', data: 'The queues ' },
  { event: 'text', data: 'look healthy.' },
  { event: 'done', data: { totalLength: 24 } },
];

describe('useAgentStream', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    tMock.mockClear();
    localStorage.setItem('accessToken', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('streams progress lines and accumulated answer text from a fixture turn', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentStream(), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('How are the queues?');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    expect(result.current.progressLines).toEqual([
      'Reading the PBX state',
      'Working on the next step',
    ]);
    expect(result.current.answerText).toBe('The queues look healthy.');
    expect(result.current.isStreaming).toBe(false);

    const assistant = store.getState().aiChat.messages.filter((m) => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
    expect(assistant[0].content).toBe('The queues look healthy.');
    expect(assistant[0].isStreaming).toBe(false);
  });

  it('names the step in the interface language, not the raw tool identifier', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentStream(), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('status');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    const rendered = [
      ...result.current.progressLines,
      result.current.answerText,
      ...store.getState().aiChat.messages.map((m) => m.content),
    ].join('\n');

    expect(rendered).toContain('Reading the PBX state');
    expect(rendered).not.toContain('get_pbx_state');
    expect(rendered).not.toContain('unknown_custom_tool');
  });

  it('accumulates text fragments on one assistant message', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentStream(), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('status');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    const assistants = store.getState().aiChat.messages.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0].content).toBe('The queues look healthy.');
  });

  it('clears in-flight state on done and leaves the answer in place', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentStream(), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('status');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    expect(store.getState().aiChat.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(store.getState().aiChat.messages.at(-1)?.content).toBe('The queues look healthy.');
  });

  it('never exposes a raw tool result payload in the conversation', async () => {
    mockFetchStream([encodeSse(FIXTURE_TURN)]);
    const store = makeStore();
    const { result } = renderHook(() => useAgentStream(), { wrapper: wrapperFor(store) });

    await act(async () => {
      result.current.send('status');
    });

    await waitFor(() => {
      expect(result.current.outcome).toBe('done');
    });

    const dumped = JSON.stringify({
      progressLines: result.current.progressLines,
      answerText: result.current.answerText,
      messages: store.getState().aiChat.messages,
    });
    expect(dumped).not.toContain('SHOULD_NOT_RENDER_RAW_QUEUE_DUMP');
    expect(dumped).not.toContain(BULKY_TOOL_RESULT);
  });
});
