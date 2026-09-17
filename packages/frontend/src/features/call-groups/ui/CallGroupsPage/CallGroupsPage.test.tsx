import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'callGroupsPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('../../model/slice/callGroupsPageSlice', () => ({
  callGroupsPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('../CallGroupsTable', () => ({
  CallGroupsTable: () => <div data-testid="call-groups-table-stub">call-groups</div>,
}));

vi.mock('../CallGroupFormModal/CallGroupFormModal', () => ({
  CallGroupFormModal: () => null,
}));

import { CallGroupsPage } from './CallGroupsPage';

describe('CallGroupsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<CallGroupsPage />);

    expect(screen.getByTestId('call-groups-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Группы вызовов' })).toBeInTheDocument();
    expect(
      screen.getByText('Группы одновременного и последовательного дозвона'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать группу/i })).toBeInTheDocument();
    expect(screen.getByTestId('call-groups-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<CallGroupsPage />);
    expect(screen.getByTestId('call-groups-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<CallGroupsPage />);

    await user.click(screen.getByRole('button', { name: /Создать группу/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'callGroupsPage/openCreateModal' });
  });
});
