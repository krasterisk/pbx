import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'trunks/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('../../model/slice/trunksPageSlice', () => ({
  trunksPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('../TrunksTable/TrunksTable', () => ({
  TrunksTable: () => <div data-testid="trunks-table-stub">trunks</div>,
}));

vi.mock('../TrunkFormModal/TrunkFormModal', () => ({
  TrunkFormModal: () => null,
}));

import { TrunksPage } from './TrunksPage';

describe('TrunksPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<TrunksPage />);

    expect(screen.getByTestId('trunks-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Транки' })).toBeInTheDocument();
    expect(screen.getByText('Управление SIP-транками к провайдерам')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить транк/i })).toBeInTheDocument();
    expect(screen.getByTestId('trunks-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<TrunksPage />);

    await user.click(screen.getByRole('button', { name: /Добавить транк/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'trunks/openCreateModal' });
  });
});
