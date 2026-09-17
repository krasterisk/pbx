import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'numbersPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/numbers', () => ({
  NumbersTable: () => <div data-testid="numbers-table-stub">numbers</div>,
  NumberFormModal: () => null,
  numbersPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { NumbersPage } from './NumbersPage';

describe('NumbersPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<NumbersPage />);

    expect(screen.getByTestId('numbers-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Списки доступа' })).toBeInTheDocument();
    expect(
      screen.getByText('Списки видимости очередей, операторов, маршрутов и CDR.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /numbers.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('numbers-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<NumbersPage />);
    expect(screen.getByTestId('numbers-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<NumbersPage />);

    await user.click(screen.getByRole('button', { name: /numbers.add/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'numbersPage/openCreateModal' });
  });
});
