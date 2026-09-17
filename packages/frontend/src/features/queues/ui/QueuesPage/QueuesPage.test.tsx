import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'queuesPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('../../model/slice/queuesPageSlice', () => ({
  queuesPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('../QueuesTable', () => ({
  QueuesTable: () => <div data-testid="queues-table-stub">queues</div>,
}));

vi.mock('../QueueFormModal/QueueFormModal', () => ({
  QueueFormModal: () => null,
}));

import { QueuesPage } from './QueuesPage';

describe('QueuesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<QueuesPage />);

    expect(screen.getByTestId('queues-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Очереди' })).toBeInTheDocument();
    expect(screen.getByText('Очереди вызовов и стратегии распределения')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать очередь/i })).toBeInTheDocument();
    expect(screen.getByTestId('queues-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<QueuesPage />);
    expect(screen.getByTestId('queues-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<QueuesPage />);

    await user.click(screen.getByRole('button', { name: /Создать очередь/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'queuesPage/openCreateModal' });
  });
});
