import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: {
      aiChat: {
        isOpen: boolean;
        messages: [];
        isStreaming: boolean;
        selectedModel: string;
        availableModels: [];
      };
    }) => unknown,
  ) =>
    sel({
      aiChat: {
        isOpen: false,
        messages: [],
        isStreaming: false,
        selectedModel: '',
        availableModels: [],
      },
    }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/api/endpoints/aiChatApi', () => ({
  useGetAiChatModelsQuery: () => ({ data: undefined }),
  streamAiChatMessage: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

import { AiChatWidget } from './AiChatWidget';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

describe('AiChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
