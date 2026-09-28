import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';
import { ConversationsTable } from './ConversationsTable';

const { exportJournalExcelMock, downloadBlobMock } = vi.hoisted(() => ({
  exportJournalExcelMock: vi.fn(() => ({ unwrap: () => Promise.resolve(new Blob(['xlsx'])) })),
  downloadBlobMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback.defaultValue === 'string') return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (selector: (state: { auth: { user: { level: number }; accessToken: null } }) => unknown) =>
    selector({ auth: { user: { level: 1 }, accessToken: null } }),
}));

vi.mock('../../api/speechAnalyticsApi', () => ({
  useExportSaJournalExcelMutation: () => [exportJournalExcelMock, { isLoading: false }],
  useDeleteSaConversationMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteSaConversationsMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/lib/csv', () => ({
  downloadBlob: downloadBlobMock,
}));

function row(id: string, patch: Partial<SaJournalRow> = {}): SaJournalRow {
  return {
    id,
    occurredAt: '2026-09-21T10:00:00.000Z',
    sourceKind: 'pbx',
    latestAmount: '1.00',
    currency: 'RUB',
    summary: 'summary',
    operatorName: 'Оператор',
    callerPhone: '100',
    durationMs: 60000,
    score: 5,
    sentiment: 'positive',
    topics: ['sales'],
    success: true,
    ...patch,
  };
}

describe('ConversationsTable', () => {
  beforeEach(() => {
    exportJournalExcelMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('shows CallsTable columns and paginates past one page', () => {
    const items = Array.from({ length: 21 }, (_, index) => row(`c-${index}`));
    render(<ConversationsTable items={items} />);

    expect(screen.getByText('Дата')).toBeInTheDocument();
    expect(screen.getByText('Имя')).toBeInTheDocument();
    expect(screen.queryByText('Ассистент')).not.toBeInTheDocument();
    expect(screen.getByText('Номер')).toBeInTheDocument();
    expect(screen.getAllByText('Источник').length).toBeGreaterThan(0);
    expect(screen.getByText('Длительность')).toBeInTheDocument();
    expect(screen.getByText('Стоимость')).toBeInTheDocument();
    expect(screen.getByText('Оценка')).toBeInTheDocument();
    expect(screen.getAllByText('Настроение').length).toBeGreaterThan(1);
    expect(screen.getByText('Темы')).toBeInTheDocument();
    expect(screen.getByText('Результат')).toBeInTheDocument();
    expect(screen.getByText(/из 21/)).toBeInTheDocument();
    expect(screen.getByTestId('journal-row-c-0')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-row-c-20')).not.toBeInTheDocument();
  });

  it('filters by search, source and score', async () => {
    const user = userEvent.setup();
    render(
      <ConversationsTable
        items={[
          row('a', { operatorName: 'Анна', sourceKind: 'upload', score: 2, callerPhone: '111' }),
          row('b', { operatorName: 'Борис', sourceKind: 'pbx', score: 5, callerPhone: '222' }),
        ]}
      />,
    );

    await user.type(screen.getByPlaceholderText('Поиск...'), 'Анна');
    expect(screen.getByTestId('journal-row-a')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-row-b')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Поиск...'));
    await user.selectOptions(screen.getByLabelText('Источник'), 'upload');
    expect(screen.getByTestId('journal-row-a')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-row-b')).not.toBeInTheDocument();
  });

  it('keeps page selection separate from all filtered rows and exports the selected IDs', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 21 }, (_, index) => row(`c-${index}`));
    render(<ConversationsTable items={items} />);

    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByTestId('table-selection-banner')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'common.selectionBannerSelectAll' }));
    await user.click(screen.getByTestId('journal-export-selected'));

    expect(exportJournalExcelMock).toHaveBeenCalledTimes(1);
    const payload = exportJournalExcelMock.mock.calls[0][0] as { ids: string[]; headers: Record<string, string> };
    expect(payload.ids).toHaveLength(21);
    expect(payload.ids).toEqual(expect.arrayContaining(['c-0', 'c-20']));
    expect(payload.headers.occurredAt).toBe('Дата');
    expect(payload.headers).not.toHaveProperty('id');
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'speech-analytics-journal.xlsx');
  });

  it('selecting a conversation does not open its details', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<ConversationsTable items={[row('c-1')]} onRowClick={onRowClick} />);

    await user.click(screen.getAllByRole('checkbox')[1]);

    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('journal-export-selected')).toBeEnabled();
  });
});
