import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsJournalPage } from './SpeechAnalyticsJournalPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (options && typeof options.defaultValue === 'string') return options.defaultValue as string;
      return key;
    },
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (selector: (state: { auth: { accessToken: string | null } }) => unknown) =>
    selector({ auth: { accessToken: null } }),
}));

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaJournalQuery: () => ({
    data: {
      items: [
        {
          id: 'conv-1',
          occurredAt: '2026-09-21T10:00:00Z',
          sourceKind: 'upload',
          latestAmount: '12.50',
          currency: 'RUB',
          summary: 'Саммари разговора',
        },
      ],
      total: 1,
      uploadProgress: { done: 0, total: 0 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetSaProjectsQuery: () => ({
    data: [{ id: 'proj-1', name: 'Support', status: 'active', draft_revision: 1, active_version_id: null }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUploadSaCabinetBatchMutation: () => [
    vi.fn(() => ({ unwrap: () => Promise.resolve({ kind: 'accepted', results: [] }) })),
    { isLoading: false },
  ],
  useRegenerateSaConversationMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteSaConversationMutation: () => [vi.fn(), { isLoading: false }],
  useGetSaConversationQuery: () => ({
    data: {
      id: 'conv-1',
      sourceKind: 'upload',
      audioUrl: '/upload.mp3',
      summary: 'Саммари разговора',
      transcriptText: 'Текст',
      rebuildInProgress: false,
      runs: [{ id: 'run-1', amount: '12.50', currency: 'RUB', createdAt: '2026-09-21T10:00:00Z' }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => (
    <div data-testid="conversation-sheet-audio-player" data-src={src} />
  ),
}));

function renderJournal(path = '/speech-analytics/conversations') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/speech-analytics/conversations" element={<SpeechAnalyticsJournalPage />} />
        <Route path="/speech-analytics/conversations/:conversationId" element={<SpeechAnalyticsJournalPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SpeechAnalyticsJournalPage', () => {
  it('opens ConversationSheet at a stable conversation URL when a row is clicked', async () => {
    const user = userEvent.setup();
    renderJournal();

    expect(screen.getByTestId('speech-analytics-journal')).toBeInTheDocument();
    await user.click(screen.getByTestId('journal-row-conv-1'));

    expect(screen.getByTestId('conversation-sheet')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Аналитика' })).toBeInTheDocument();
  });

  it('opens the sheet from a deep-linked conversation URL', () => {
    renderJournal('/speech-analytics/conversations/conv-1');

    expect(screen.getByTestId('conversation-sheet')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Стоимость' })).toBeInTheDocument();
  });
});
