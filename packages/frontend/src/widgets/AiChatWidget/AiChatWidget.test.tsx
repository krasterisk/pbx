import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: {
      aiChat: {
        isOpen: boolean;
        messages: [];
        isStreaming: boolean;
        selectedModel: string;
        availableModels: { name: string; displayName: string }[];
      };
    }) => unknown,
  ) =>
    sel({
      aiChat: {
        isOpen: false,
        messages: [],
        isStreaming: false,
        selectedModel: 'gpt-test',
        availableModels: [{ name: 'gpt-test', displayName: 'Test Model' }],
      },
    }),
  useAppDispatch: () => vi.fn(),
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
  useDeleteAiChatThreadMutation: () => [vi.fn(), { isLoading: false }],
  streamAiChatMessage: vi.fn(),
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
});
