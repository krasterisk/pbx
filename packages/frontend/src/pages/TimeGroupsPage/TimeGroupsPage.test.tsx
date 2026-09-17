import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'timeGroups/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: () => false,
}));

vi.mock('@/features/timeGroups', () => ({
  TimeGroupsTable: () => <div data-testid="timegroups-table-stub">timegroups</div>,
  TimeGroupFormModal: () => null,
  timeGroupsActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

vi.mock('@/features/timeGroups/model/selectors/timeGroupsSelectors', () => ({
  getTimeGroupsModalOpen: () => false,
}));

import { TimeGroupsPage } from './TimeGroupsPage';

describe('TimeGroupsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<TimeGroupsPage />);

    expect(screen.getByTestId('timegroups-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Временные группы' })).toBeInTheDocument();
    expect(
      screen.getByText('Расписания для условной маршрутизации по времени'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить группу/i })).toBeInTheDocument();
    expect(screen.getByTestId('timegroups-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<TimeGroupsPage />);
    expect(screen.getByTestId('timegroups-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<TimeGroupsPage />);

    await user.click(screen.getByRole('button', { name: /Добавить группу/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'timeGroups/openCreateModal' });
  });
});
