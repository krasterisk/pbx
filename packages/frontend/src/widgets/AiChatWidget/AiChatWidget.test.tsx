import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AgentTimelineItem } from '@krasterisk/shared';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

const aiChatState = {
  isOpen: false,
  isStreaming: false,
  selectedModel: 'gpt-test',
  availableModels: [{ name: 'gpt-test', displayName: 'Test Model' }],
  turnOutcome: 'idle' as string,
};

const turnApi = {
  send: vi.fn(),
  continueAfterApply: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  retry: vi.fn(),
  isStreaming: false,
  outcome: 'idle' as string,
};

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: { aiChat: typeof aiChatState }) => unknown,
  ) => sel({ aiChat: aiChatState }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/ai-chat/model/useAgentTurn', () => ({
  useAgentTurn: () => turnApi,
}));

const AT = '2026-09-03T12:00:00.000Z';
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';

const storedThreads = [
  {
    uid: 7,
    title: "Yesterday's call",
    status: 'active' as const,
    last_message_at: AT,
    created_at: AT,
    updated_at: AT,
  },
];

const storedThreadDetail: {
  uid: number;
  title: string;
  status: 'active';
  last_message_at: string;
  created_at: string;
  updated_at: string;
  timeline: AgentTimelineItem[];
  cards: Record<string, { card: 'single'; proposal: {
    proposalId: string;
    entityType: string;
    entityLabel: string;
    summary: string[];
    status: string;
    expiresAt: string;
    error: string | null;
  } }>;
} = {
  uid: 7,
  title: "Yesterday's call",
  status: 'active',
  last_message_at: AT,
  created_at: AT,
  updated_at: AT,
  timeline: [
    { kind: 'user', id: 'm1', text: 'Stored user message from yesterday', createdAt: AT },
    { kind: 'step', id: 's1', labelKey: 'aiChat.progress.tools.create_directory', labelFallback: 'create_directory', done: true, createdAt: AT },
    { kind: 'proposal', id: 'p1', card: 'single', createdAt: AT },
    { kind: 'assistant', id: 'm4', text: 'Stored assistant reply', closeKind: 'wait_confirm', createdAt: AT },
    { kind: 'user', id: 'm5', text: 'And also add a trunk', createdAt: AT },
    { kind: 'assistant', id: 'm6', text: 'I will propose a trunk next', closeKind: 'complete', createdAt: AT },
  ],
  cards: {
    p1: {
      card: 'single',
      proposal: {
        proposalId: PROPOSAL_ID,
        entityType: 'directory',
        entityLabel: 'VIP',
        summary: ['Добавить поле num'],
        status: 'pending',
        expiresAt: '2027-09-05T12:00:00.000Z',
        error: null,
      },
    },
  },
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
    () => ({
      unwrap: async () => ({
        ok: true,
        proposal: {
          proposalId: PROPOSAL_ID,
          entityType: 'directory',
          entityLabel: 'VIP',
          summary: ['Добавить поле num'],
          status: 'applied',
          expiresAt: '2027-09-05T12:00:00.000Z',
          appliedAt: '2026-09-07T15:30:33.000Z',
          error: null,
        },
      }),
    }),
    { isLoading: false },
  ],
  useRejectAiChatProposalMutation: () => [
    () => ({ unwrap: async () => ({ ok: true }) }),
    { isLoading: false },
  ],
  useConfirmAiChatWorkflowMutation: () => [
    () => ({ unwrap: async () => ({ status: 'applied', steps: [] }) }),
    { isLoading: false },
  ],
  useRejectAiChatWorkflowMutation: () => [
    () => ({ unwrap: async () => ({ status: 'rejected', steps: [] }) }),
    { isLoading: false },
  ],
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

function selectStoredThread() {
  fireEvent.click(screen.getByRole('option', { name: /Yesterday's call/ }));
}

describe('AiChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewport(1280);
    Element.prototype.scrollIntoView = vi.fn();
    aiChatState.isStreaming = false;
    aiChatState.turnOutcome = 'idle';
    storedThreadDetail.timeline = [
      { kind: 'user', id: 'm1', text: 'Stored user message from yesterday', createdAt: AT },
      { kind: 'step', id: 's1', labelKey: 'aiChat.progress.tools.create_directory', labelFallback: 'create_directory', done: true, createdAt: AT },
      { kind: 'proposal', id: 'p1', card: 'single', createdAt: AT },
      { kind: 'assistant', id: 'm4', text: 'Stored assistant reply', closeKind: 'wait_confirm', createdAt: AT },
      { kind: 'user', id: 'm5', text: 'And also add a trunk', createdAt: AT },
      { kind: 'assistant', id: 'm6', text: 'I will propose a trunk next', closeKind: 'complete', createdAt: AT },
    ];
    turnApi.send.mockReset();
    turnApi.continueAfterApply.mockReset();
    turnApi.stop.mockReset();
    turnApi.abort.mockReset();
    turnApi.retry.mockReset();
    turnApi.isStreaming = false;
    turnApi.outcome = 'idle';
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
    expect(scss).toMatch(/--ai-agent-panel-width:\s*60vw/);
    expect(scss).toMatch(/width:\s*var\(--ai-agent-panel-width\)/);
    expect(scss).toMatch(/max-width:\s*1023px[\s\S]*--ai-agent-panel-width:\s*520px/);
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

  it('renders the thread timeline from the cache, not from a local list', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.queryByText('Stored user message from yesterday')).toBeNull();
    selectStoredThread();
    expect(screen.getByTestId('ai-agent-timeline')).toBeInTheDocument();
    expect(screen.getByText('Stored user message from yesterday')).toBeInTheDocument();
    expect(screen.getByText('Stored assistant reply')).toBeInTheDocument();
  });

  it('places a card at the item that produced it', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();

    const conversation = screen.getByTestId('ai-agent-conversation');
    const text = conversation.textContent ?? '';
    const userAt = text.indexOf('Stored user message from yesterday');
    const cardAt = text.indexOf('VIP');
    const laterUserAt = text.indexOf('And also add a trunk');
    const laterAssistantAt = text.indexOf('I will propose a trunk next');
    expect(cardAt).toBeGreaterThan(-1);
    expect(text.indexOf('Добавить поле num')).toBeGreaterThan(-1);
    expect(screen.getByRole('button', { name: 'aiChat.card.apply' })).toBeInTheDocument();
    expect(cardAt).toBeGreaterThan(userAt);
    expect(laterUserAt).toBeGreaterThan(cardAt);
    expect(laterAssistantAt).toBeGreaterThan(laterUserAt);
  });

  it('continues the conversation through the continue endpoint after apply', async () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.card.apply' }));
    await vi.waitFor(() => expect(turnApi.continueAfterApply).toHaveBeenCalledTimes(1));
    expect(turnApi.send).not.toHaveBeenCalled();
  });

  it('leaves no technical data in the panel markup', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    const html = screen.getByTestId('ai-agent-panel').innerHTML;
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    expect(html).not.toMatch(/\b(e|ew)\d+_\d+\b/);
    expect(html).not.toMatch(/\bq\w+_\d+\b/);
    expect(html).not.toMatch(/"proposalId"|applyPayload|tool_call/);
  });

  it('does not render a tool plan block', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    expect(screen.queryByText(/План выполнения|Execution plan/i)).toBeNull();
  });

  it('clears the conversation column after deleting the selected conversation', async () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
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
    expect(ru.aiChat).not.toHaveProperty('continueAfterApply');
    expect(en.aiChat).not.toHaveProperty('continueAfterApply');
  });

  it('does not render a model selector in the tenant panel', () => {
    render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.queryByTitle('aiChat.selectModel')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });

  it('replaces send with stop while a turn is in flight and returns to send after', () => {
    turnApi.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'aiChat.stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aiChat.send' })).toBeNull();

    turnApi.isStreaming = false;
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'aiChat.send' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aiChat.stop' })).toBeNull();
  });

  it('pressing stop calls the stream abort and shows the stopped outcome', () => {
    turnApi.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'aiChat.stop' }));
    expect(turnApi.stop).toHaveBeenCalledTimes(1);

    turnApi.isStreaming = false;
    turnApi.outcome = 'stopped';
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.stopped')).toBeInTheDocument();
  });

  it('renders ceiling, failure and disconnect as distinct outcomes', () => {
    turnApi.outcome = 'ceiling';
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.ceiling')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.stopped')).toBeNull();
    expect(screen.queryByText('aiChat.failed')).toBeNull();

    turnApi.outcome = 'failed';
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(screen.getByText('aiChat.failed')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.ceiling')).toBeNull();

    turnApi.outcome = 'disconnected';
    storedThreadDetail.timeline = [
      { kind: 'assistant', id: 'a1', text: 'partial so far', closeKind: 'complete', createdAt: AT },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    expect(screen.getByText('aiChat.disconnected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiChat.reconnect' })).toBeInTheDocument();
    expect(screen.getByText('partial so far')).toBeInTheDocument();
    expect(screen.queryByText('aiChat.ceiling')).toBeNull();
    expect(screen.queryByText('aiChat.failed')).toBeNull();
  });

  it('aborts the in-flight request when the panel closes', () => {
    turnApi.isStreaming = true;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    rerender(<AiChatWidget open={false} onClose={vi.fn()} />);
    expect(turnApi.abort).toHaveBeenCalledTimes(1);
  });

  function mockScroller(el: HTMLElement, metrics: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: metrics.scrollTop });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: metrics.clientHeight });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  }

  it('keeps the conversation at the bottom while the reader is already there', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 400, clientHeight: 200, scrollHeight: 600 });
    fireEvent.scroll(scroller);

    scrollIntoView.mockClear();
    storedThreadDetail.timeline = [
      ...storedThreadDetail.timeline,
      { kind: 'assistant', id: 'm7', text: 'first then more', closeKind: 'complete', createdAt: AT },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('stops following after the user scrolls up and shows jump-to-latest', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 40, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);

    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();

    scrollIntoView.mockClear();
    storedThreadDetail.timeline = [
      ...storedThreadDetail.timeline,
      { kind: 'assistant', id: 'm7', text: 'first then more', closeKind: 'complete', createdAt: AT },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();
  });

  it('resumes following when the reader returns to the bottom', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<AiChatWidget open onClose={vi.fn()} />);
    selectStoredThread();
    const scroller = screen.getByTestId('ai-agent-messages');
    mockScroller(scroller, { scrollTop: 40, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'aiChat.jumpToLatest' })).toBeInTheDocument();

    mockScroller(scroller, { scrollTop: 600, clientHeight: 200, scrollHeight: 800 });
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'aiChat.jumpToLatest' })).toBeNull();

    scrollIntoView.mockClear();
    storedThreadDetail.timeline = [
      ...storedThreadDetail.timeline,
      { kind: 'assistant', id: 'm7', text: 'first then more', closeKind: 'complete', createdAt: AT },
    ];
    rerender(<AiChatWidget open onClose={vi.fn()} />);
    expect(scrollIntoView).toHaveBeenCalled();
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
