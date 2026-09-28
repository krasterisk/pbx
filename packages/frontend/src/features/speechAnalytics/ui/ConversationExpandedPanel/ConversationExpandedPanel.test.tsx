import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationExpandedPanel } from './ConversationExpandedPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => (
    <div data-testid="conversation-expanded-audio-player" data-src={src} />
  ),
}));

const baseProps = {
  conversationId: 'conv-1',
  summary: 'Предыдущий саммари',
  transcriptText: 'Оператор: здравствуйте',
  runs: [{ id: 'run-1', amount: '12.50', currency: 'RUB', createdAt: '2026-09-21T10:00:00Z' }],
};

describe('ConversationExpandedPanel', () => {
  it('renders Analytics, Transcript, and Cost tabs with locked copy', async () => {
    const user = userEvent.setup();
    render(<ConversationExpandedPanel {...baseProps} sourceKind="upload" audioUrl="/audio.mp3" />);

    expect(screen.getByRole('tab', { name: 'Аналитика' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Расшифровка' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Стоимость' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Стоимость' }));
    expect(screen.getByText('Посчитано, не списано')).toBeInTheDocument();
  });

  it('hides the player for PBX-sourced conversations', async () => {
    const user = userEvent.setup();
    render(<ConversationExpandedPanel {...baseProps} sourceKind="pbx" audioUrl="/cdr-audio.mp3" />);

    expect(screen.queryByTestId('conversation-expanded-audio-player')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Расшифровка' }));
    expect(screen.queryByTestId('conversation-expanded-audio-player')).not.toBeInTheDocument();
  });

  it('shows the player only on Transcript for upload-sourced conversations', async () => {
    const user = userEvent.setup();
    render(<ConversationExpandedPanel {...baseProps} sourceKind="upload" audioUrl="/upload.mp3" />);

    expect(screen.queryByTestId('conversation-expanded-audio-player')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Расшифровка' }));
    expect(screen.getByTestId('conversation-expanded-audio-player')).toBeInTheDocument();
  });

  it('keeps the previous result visible with a rebuild badge while rebuild is in progress', () => {
    render(
      <ConversationExpandedPanel
        {...baseProps}
        sourceKind="upload"
        rebuildInProgress
        summary="Предыдущий саммари"
      />,
    );

    expect(screen.getByText('Предыдущий саммари')).toBeInTheDocument();
    expect(screen.getByText('Идёт пересборка')).toBeInTheDocument();
  });

  it('hides delete and rebuild until a superadmin opens the row', () => {
    render(<ConversationExpandedPanel {...baseProps} sourceKind="pbx" />);
    expect(screen.queryByTestId('conversation-admin-actions')).not.toBeInTheDocument();
  });

  it('shows rebuild and delete for a superadmin in the tenant cabinet', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    const onDelete = vi.fn();
    render(
      <ConversationExpandedPanel
        {...baseProps}
        sourceKind="pbx"
        canManage
        onRegenerate={onRegenerate}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByTestId('conversation-regenerate'));
    await user.click(screen.getByTestId('conversation-delete'));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
