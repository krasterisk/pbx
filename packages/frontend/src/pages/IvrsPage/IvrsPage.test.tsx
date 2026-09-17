import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'ivrs/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: () => false,
}));

vi.mock('@/features/ivrs', () => ({
  IvrsTable: () => <div data-testid="ivrs-table-stub">ivrs</div>,
  IvrFormModal: () => null,
  ivrsActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/ivrs/model/selectors/ivrsSelectors', () => ({
  getIvrsIsModalOpen: () => false,
  getIvrsSelectedIvr: () => null,
  getIvrsModalMode: () => 'create',
}));

import { IvrsPage } from './IvrsPage';

describe('IvrsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<IvrsPage />);

    expect(screen.getByTestId('ivrs-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Голосовые меню (IVR)' })).toBeInTheDocument();
    expect(screen.getByText('Настройка интерактивных голосовых меню')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить IVR/i })).toBeInTheDocument();
    expect(screen.getByTestId('ivrs-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<IvrsPage />);
    expect(screen.getByTestId('ivrs-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<IvrsPage />);

    await user.click(screen.getByRole('button', { name: /Добавить IVR/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ivrs/openCreateModal' });
  });
});
