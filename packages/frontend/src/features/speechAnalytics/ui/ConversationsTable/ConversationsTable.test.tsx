import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';
import { ConversationsTable } from './ConversationsTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback.defaultValue === 'string') return fallback.defaultValue;
      return key;
    },
  }),
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
});
