import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'contexts/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/contexts', () => ({
  ContextsTable: () => <div data-testid="contexts-table-stub">contexts</div>,
  ContextFormModal: () => null,
  contextsActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { ContextsPage } from './ContextsPage';

describe('ContextsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<ContextsPage />);

    expect(screen.getByTestId('contexts-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Контексты' })).toBeInTheDocument();
    expect(
      screen.getByText('Контексты маршрутизации входящих и исходящих вызовов'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить контекст/i })).toBeInTheDocument();
    expect(screen.getByTestId('contexts-table-stub')).toBeInTheDocument();
  });

  it('exposes hybrid-table overflow marker at page level', () => {
    render(<ContextsPage />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('contexts-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<ContextsPage />);

    await user.click(screen.getByRole('button', { name: /Добавить контекст/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'contexts/openCreateModal' });
  });
});
