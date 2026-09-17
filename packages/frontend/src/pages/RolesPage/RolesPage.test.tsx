import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'rolesPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/roles', () => ({
  RolesTable: () => <div data-testid="roles-table-stub">roles</div>,
  RoleFormModal: () => null,
  rolesPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { RolesPage } from './RolesPage';

describe('RolesPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<RolesPage />);

    expect(screen.getByTestId('roles-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Профили доступа' })).toBeInTheDocument();
    expect(
      screen.getByText('Профили доступа определяют, какие модули системы пользователь видит в интерфейсе.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roles.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('roles-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<RolesPage />);
    expect(screen.getByTestId('roles-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<RolesPage />);

    await user.click(screen.getByRole('button', { name: /roles.add/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'rolesPage/openCreateModal' });
  });
});
