import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'moh/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/moh', () => ({
  MohTable: () => <div data-testid="moh-table-stub">moh</div>,
  MohFormModal: () => null,
  mohActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { MohPage } from './MohPage';

describe('MohPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<MohPage />);

    expect(screen.getByTestId('moh-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'moh.title' })).toBeInTheDocument();
    expect(screen.getByText('moh.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /moh.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('moh-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<MohPage />);
    expect(screen.getByTestId('moh-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<MohPage />);

    await user.click(screen.getByRole('button', { name: /moh.add/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'moh/openCreateModal' });
  });
});
