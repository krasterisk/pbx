import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

const aiChatState = {
  isOpen: false,
  messages: [] as Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: number;
    isStreaming?: boolean;
  }>,
  isStreaming: false,
  selectedModel: 'gpt-test',
  availableModels: [{ name: 'gpt-test', displayName: 'Test Model' }],
  progressLines: [] as string[],
  turnOutcome: 'idle' as string,
};

const streamApi = {
  send: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  retry: vi.fn(),
  lastMessage: '',
  progressLines: [] as string[],
  answerText: '',
  isStreaming: false,
  outcome: 'idle' as string,
  proposal: null as {
    proposalId: string;
    entityType: string;
    entityLabel: string;
    summary: string[];
    status: string;
    expiresAt: string;
    error: string | null;
  } | null,
};

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: { aiChat: typeof aiChatState }) => unknown,
  ) => sel({ aiChat: aiChatState }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/ai-chat/model/useAgentStream', () => ({
  useAgentStream: () => streamApi,
}));

const storedThreads = [
  {
    uid: 7,
    title: "Yesterday's call",
    status: 'active' as const,
    last_message_at: '2026-09-03T12:00:00.000Z',
    created_at: '2026-09-03T12:00:00.000Z',
    updated_at: '2026-09-03T12:00:00.000Z',
  },
];

const storedThreadDetail = {
  uid: 7,
  title: "Yesterday's call",
  status: 'active' as const,
  last_message_at: '2026-09-03T12:00:00.000Z',
  created_at: '2026-09-03T12:00:00.000Z',
  updated_at: '2026-09-03T12:00:00.000Z',
  messages: [
    {
      uid: 71,
      thread_uid: 7,
      role: 'user' as const,
      content: 'Stored user message from yesterday',
      created_at: '2026-09-03T12:00:00.000Z',
    },
    {
      uid: 72,
      thread_uid: 7,
      role: 'assistant' as const,
      content: 'Stored assistant reply',
      created_at: '2026-09-03T12:01:00.000Z',
      proposal_id: '11111111-1111-4111-8111-111111111111',
      proposal: {
        proposalId: '11111111-1111-4111-8111-111111111111',
        entityType: 'directory',
        entityLabel: 'VIP',
        summary: ['Добавить поле num'],
        status: 'pending',
        expiresAt: '2026-09-05T12:00:00.000Z',
        error: null,
      },
    },
    {
      uid: 73,
      thread_uid: 7,
      role: 'user' as const,
      content: 'And also add a trunk',
      created_at: '2026-09-03T12:02:00.000Z',
    },
    {
      uid: 74,
      thread_uid: 7,
      role: 'assistant' as const,
      content: 'I will propose a trunk next',
      created_at: '2026-09-03T12:03:00.000Z',
    },
  ],
};

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatModelsQuery: () => ({ data: undefined }),
  useGetAiChatThreadsQuery: () => ({
    data: storedThreads,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetAiChatThreadQuery: (uid: number | undefined, options?: { skip?: boolean }) => {
    if (options?.skip || uid == null) return { data: undefined, isFetching: false };
    return { data: storedThreadDetail, isFetching: false };
  },
  useCreateAiChatThreadMutation: () => [
    () => ({ unwrap: async () => storedThreads[0] }),
    { isLoading: false },
  ],
  useDeleteAiChatThreadMutation: () => [
    () => ({ unwrap: async () => undefined }),
    { isLoading: false },
  ],
  useConfirmAiChatProposalMutation: () => [
    () => ({ unwrap: async () => ({ ok: true }) }),
    { isLoading: false },
  ],
  useRejectAiChatProposalMutation: () => [
    () => ({ unwrap: async () => ({ ok: true }) }),
    { isLoading: false },
  ],
  streamAiChatMessage: vi.fn(),
  isProposalClientView: (value: unknown) =>
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'proposalId' in value &&
    !('applyPayload' in value) &&
    !('apply_payload' in value),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

import { AiChatWidget } from './AiChatWidget';
import { en } from '@/shared/config/locales/en';
import { ru } from '@/shared/config/locales/ru';

function localeKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [prefix];
  return entries.flatMap(([key, child]) => localeKeys(child, prefix ? `${prefix}.${key}` : key));
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

function mockViewport(width: number) {
  useIsMobileMock.mockImplementation((bp = 768) => width < bp);
}

describe('AiChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewport(1280);
    Element.prototype.scrollIntoView = vi.fn();
    aiChatState.messages = [];
    aiChatState.isStreaming = false;
    aiChatState.progressLines = [];
    aiChatState.turnOutcome = 'idle';
    streamApi.send.mockReset();
    streamApi.stop.mockReset();
    streamApi.abort.mockReset();
    streamApi.retry.mockReset();
    streamApi.progressLines = [];
    streamApi.answerText = '';
    streamApi.isStreaming = false;
    streamApi.outcome = 'idle';
    streamApi.proposal = null;
  });

  it('does not render the former floating trigger', () => {
    render(<AiChatWidget open={false} onClose={vi.fn()} />);
    expect(document.getElementById('ai-chat-trigger')).toBeNull();
    expect(document.querySelector('[class*="triggerBtn"]')).toBeNull();
  });

  it('exposes the panel with a stable test id and open state', () => {
    const { rerender } = render(<AiChatWidget open={false} onClose={vi.fn()} />);
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'false');
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByTestId('ai-agent-panel')).toHaveAttribute('data-open', 'true');
  });

  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn();
    render(<AiChatWidget open onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('ai-agent-panel'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab inside the open panel and never reaches the page behind', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <div>
        <button type="button">page-behind</button>
        <AiChatWidget open onClose={vi.fn()} />
      </div>,
    );

    const panel = screen.getByTestId('ai-agent-panel');
    const focusable = getFocusable(panel);
    expect(focusable.length).toBeGreaterThan(1);

    focusable[focusable.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(focusable[0]);
    expect(screen.getByRole('button', { name: 'page-behind' })).not.toHaveFocus();

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    expect(screen.getByRole('button', { name: 'page-behind' })).not.toHaveFocus();
  });

  it('takes panel width from the stylesheet and never from an inline style', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    const panel = screen.getByTestId('ai-agent-panel');
    expect(panel.getAttribute('style') ?? '').not.toMatch(/width|height|left|right|top|bottom/);
    const scss = readFileSync(
      join(process.cwd(), 'src/widgets/AiChatWidget/AiChatWidget.module.scss'),
      'utf8',
    );
    expect(scss).toMatch(/--ai-agent-panel-width:\s*520px/);
    expect(scss).toMatch(/width:\s*var\(--ai-agent-panel-width\)/);
  });

  it('renders a thread rail beside the conversation above the wide breakpoint', () => {
    mockViewport(1280);
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByTestId('ai-agent-thread-rail')).toBeInTheDocument();
    expect(screen.getByTestId('ai-agent-conversation')).toBeInTheDocument();
  });

  it('omits the thread rail below the wide breakpoint', () => {
    mockViewport(800);
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.queryByTestId('ai-agent-thread-rail')).toBeNull();
  });

  it('loads stored messages when a conversation is selected from the rail', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.queryByText('Stored user message from yesterday')).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Yesterday's call/ }));
    expect(screen.getByText('Stored user message from yesterday')).toBeInTheDocument();
    expect(screen.getByText('Stored assistant reply')).toBeInTheDocument();
  });

  it('places a stored change card at the turn that produced it', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('option', { name: /Yesterday's call/ }));

    const conversation = screen.getByTestId('ai-agent-conversation');
    const text = conversation.textContent ?? '';
    const cardAt = text.indexOf('VIP');
    const laterUserAt = text.indexOf('And also add a trunk');
    const laterAssistantAt = text.indexOf('I will propose a trunk next');
    expect(cardAt).toBeGreaterThan(-1);
    expect(text.indexOf('Добавить поле num')).toBeGreaterThan(-1);
    expect(screen.getByRole('button', { name: 'aiChat.card.apply' })).toBeInTheDocument();
    expect(laterUserAt).toBeGreaterThan(cardAt);
    expect(laterAssistantAt).toBeGreaterThan(laterUserAt);
  });

  it('clears the conversation column after deleting the selected conversation', async () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('option', { name: /Yesterday's call/ }));
    expect(screen.getByText('Stored user message from yesterday')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'aiChat.deleteConversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.deleteConfirm' }));

    await vi.waitFor(() => {
      expect(screen.queryByText('Stored user message from yesterday')).toBeNull();
    });
    expect(screen.getByText('aiChat.welcome')).toBeInTheDocument();
  });

  it('renders as a full-height sheet with no horizontal offset below the tablet breakpoint', () => {
    mockViewport(600);
    render(<AiChatWidget open onClose={vi.fn()} />);
    const panel = screen.getByTestId('ai-agent-panel');
    expect(panel).toHaveAttribute('data-sheet', 'true');
    const scss = readFileSync(
      join(process.cwd(), 'src/widgets/AiChatWidget/AiChatWidget.module.scss'),
      'utf8',
    );
    expect(scss).toMatch(/max-width:\s*767px[\s\S]*width:\s*100vw/);
    expect(scss).toMatch(/max-width:\s*767px[\s\S]*left:\s*0/);
  });

  it('lays header, body, composer and footer out as separate grid rows', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    const panel = screen.getByTestId('ai-agent-panel');
    expect(screen.getByTestId('ai-agent-header')).toBeInTheDocument();
    expect(screen.getByTestId('ai-agent-body')).toBeInTheDocument();
    expect(screen.getByTestId('ai-agent-composer')).toBeInTheDocument();
    expect(screen.getByTestId('ai-agent-footer')).toBeInTheDocument();
    const scss = readFileSync(
      join(process.cwd(), 'src/widgets/AiChatWidget/AiChatWidget.module.scss'),
      'utf8',
    );
    expect(scss).toMatch(/grid-template-areas:[\s\S]*header[\s\S]*body[\s\S]*composer[\s\S]*footer/);
    expect(panel.getAttribute('style') ?? '').not.toMatch(/grid|display/);
  });

  it('keeps matching aiChat locale keys in ru and en', () => {
    expect(localeKeys(ru.aiChat)).toEqual(localeKeys(en.aiChat));
    expect(ru.aiChat.title).toBe('AI-ассистент');
    expect(en.aiChat.title).toBe('AI Assistant');
    expect(ru.aiChat.closePanel).toBe('Закрыть панель');
    expect(en.aiChat.shortcutHint).toBe('{{mod}}+Shift+J');
  });

  it('does not render a model selector in the tenant panel', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.queryByTitle('aiChat.selectModel')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });

  it('replaces send with stop while a turn is in flight and returns to send after', () => {
    aiChatState.isStreaming = true;
    streamApi.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'aiChat.stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aiChat.send' })).toBeNull();

    aiChatState.isStreaming = false;
    streamApi.isStreaming = false;
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'aiChat.send' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aiChat.stop' })).toBeNull();
  });

  it('pressing stop calls the stream abort and shows the stopped outcome', () => {
    aiChatState.isStreaming = true;
    streamApi.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.stop' }));
    expect(streamApi.stop).toHaveBeenCalledTimes(1);

    streamApi.isStreaming = false;
    streamApi.outcome = 'stopped';
    aiChatState.isStreaming = false;
    aiChatState.turnOutcome = 'stopped';
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.stopped')).toBeInTheDocument();
  });

  it('renders ceiling, failure and disconnect as distinct outcomes', () => {
    streamApi.outcome = 'ceiling';
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.ceiling')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.stopped')).toBeNull();
    expect(screen.queryByText('aiChat.failed')).toBeNull();

    streamApi.outcome = 'failed';
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.failed')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.ceiling')).toBeNull();

    streamApi.outcome = 'disconnected';
    streamApi.answerText = 'partial so far';
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'partial so far', createdAt: Date.now() },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.disconnected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiChat.reconnect' })).toBeInTheDocument();
    expect(screen.getByText('partial so far')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.ceiling')).toBeNull();
    expect(screen.queryByText('aiChat.failed')).toBeNull();
  });

  it('aborts the in-flight request when the panel closes', () => {
    streamApi.isStreaming = true;
    aiChatState.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    rerender(<AiChatWidget open={false} onClose={vi.fn()} />);
    expect(streamApi.abort).toHaveBeenCalledTimes(1);
  });

  function mockScroller(el: HTMLElement, metrics: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: metrics.scrollTop });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: metrics.clientHeight });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  }

  it('keeps the conversation at the bottom while the reader is already there', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first', createdAt: Date.now() },
    ];
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 400, clientHeight: 200, scrollHeight: 600 });
    fireEvent.scroll(scroller);

    scrollIntoView.mockClear();
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first then more', createdAt: Date.now() },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('stops following after the user scrolls up and shows jump-to-latest', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first', createdAt: Date.now() },
    ];
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 40, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);

    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();

    scrollIntoView.mockClear();
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first then more', createdAt: Date.now() },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();
  });

  it('resumes following when the reader returns to the bottom', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first', createdAt: Date.now() },
    ];
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 40, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();

    mockScroller(scroller, { scrollTop: 600, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'aiChat.jumpToLatest' })).toBeNull();

    scrollIntoView.mockClear();
    aiChatState.messages = [
      { id: 'a1', role: 'assistant', content: 'first then more', createdAt: Date.now() },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('renders a mid-stream change card in place and continues the text below it', () => {
    streamApi.proposal = {
      proposalId: '22222222-2222-4222-8222-222222222222',
      entityType: 'trunk',
      entityLabel: 'SIP-1',
      summary: ['Add a SIP trunk'],
      status: 'pending',
      expiresAt: '2026-09-05T12:00:00.000Z',
      error: null,
    };
    streamApi.isStreaming = true;
    aiChatState.isStreaming = true;
    aiChatState.messages = [
      { id: 'u1', role: 'user', content: 'Add a trunk please', createdAt: Date.now() },
      { id: 'a1', role: 'assistant', content: 'Here is the change, then I continue.', createdAt: Date.now(), isStreaming: true },
    ];
    render(<AiChatWidget open onClose={vi.fn()} />);

    const conversation = screen.getByTestId('ai-agent-conversation');
    const text = conversation.textContent ?? '';
    const userAt = text.indexOf('Add a trunk please');
    const cardAt = text.indexOf('SIP-1');
    const afterAt = text.indexOf('Here is the change, then I continue.');
    expect(userAt).toBeGreaterThan(-1);
    expect(cardAt).toBeGreaterThan(userAt);
    expect(afterAt).toBeGreaterThan(cardAt);
    expect(screen.getByRole('button', { name: 'aiChat.card.apply' })).toBeInTheDocument();
  });

  it('keeps streaming copy keys in both locale files', () => {
    const streamingKeys = [
      'aiChat.progress.working',
      'aiChat.progress.tools.get_pbx_state',
      'aiChat.stopped',
      'aiChat.ceiling',
      'aiChat.failed',
      'aiChat.disconnected',
      'aiChat.reconnect',
      'aiChat.jumpToLatest',
    ];
    for (const key of streamingKeys) {
      const path = key.replace(/^aiChat\./, '').split('.');
      let enNode: unknown = en.aiChat;
      let ruNode: unknown = ru.aiChat;
      for (const part of path) {
        enNode = (enNode as Record<string, unknown>)[part];
        ruNode = (ruNode as Record<string, unknown>)[part];
      }
      expect(typeof enNode).toBe('string');
      expect(typeof ruNode).toBe('string');
      expect(enNode).not.toBe(ruNode);
    }
    expect(en.aiChat.stopped).toBe('Stopped');
    expect(ru.aiChat.stopped).toBe('Остановлено');
    expect(en.aiChat.ceiling).toBe('Step limit reached. Narrow the task or start a new chat.');
    expect(ru.aiChat.jumpToLatest).toBe('К последним сообщениям');
  });
});
