import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationSheet } from './ConversationSheet';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => (
    <div data-testid="conversation-sheet-audio-player" data-src={src} />
  ),
}));

const baseProps = {
  open: true,
  conversationId: 'conv-1',
  onOpenChange: vi.fn(),
  summary: 'Предыдущий саммари',
  transcriptText: 'Оператор: здравствуйте',
  runs: [{ id: 'run-1', amount: '12.50', currency: 'RUB', createdAt: '2026-09-21T10:00:00Z' }],
};

describe('ConversationSheet', () => {
  it('renders Analytics, Transcript, and Cost tabs with locked copy', () => {
    render(<ConversationSheet {...baseProps} sourceKind="upload" audioUrl="/audio.mp3" />);

    expect(screen.getByRole('tab', { name: 'Аналитика' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Расшифровка' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Стоимость' })).toBeInTheDocument();
    expect(screen.getByText('Посчитано, не списано')).toBeInTheDocument();
  });

  it('hides sheet player for PBX-sourced conversations', async () => {
    const user = userEvent.setup();
    render(<ConversationSheet {...baseProps} sourceKind="pbx" audioUrl="/cdr-audio.mp3" />);

    expect(screen.queryByTestId('conversation-sheet-audio-player')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Расшифровка' }));
    expect(screen.queryByTestId('conversation-sheet-audio-player')).not.toBeInTheDocument();
  });

  it('shows player only on Transcript for upload-sourced conversations', async () => {
    const user = userEvent.setup();
    render(<ConversationSheet {...baseProps} sourceKind="upload" audioUrl="/upload.mp3" />);

    expect(screen.queryByTestId('conversation-sheet-audio-player')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Расшифровка' }));
    expect(screen.getByTestId('conversation-sheet-audio-player')).toBeInTheDocument();
  });

  it('keeps previous result visible with rebuild badge while rebuild is in progress', () => {
    render(
      <ConversationSheet
        {...baseProps}
        sourceKind="upload"
        rebuildInProgress
        summary="Предыдущий саммари"
      />,
    );

    expect(screen.getByText('Предыдущий саммари')).toBeInTheDocument();
    expect(screen.getByText('Идёт пересборка')).toBeInTheDocument();
  });

  it('exposes icon-only close with title and aria-label', () => {
    render(<ConversationSheet {...baseProps} sourceKind="pbx" />);

    const close = screen.getByRole('button', { name: 'Закрыть' });
    expect(close).toHaveAttribute('title', 'Закрыть');
    expect(close).toHaveAttribute('aria-label', 'Закрыть');
  });
});
