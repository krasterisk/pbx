import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const dispatch = vi.fn();
const openCreateModal = vi.fn(() => ({ type: 'usersPage/openCreateModal' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/users', () => ({
  UsersTable: () => <div data-testid="users-table-stub">users</div>,
  UserFormModal: () => null,
  usersPageActions: {
    openCreateModal: () => openCreateModal(),
  },
}));

import { UsersPage } from './UsersPage';

describe('UsersPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<UsersPage />);

    expect(screen.getByTestId('users-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
    expect(
      screen.getByText('Пользователи модуля Система: роли, профили и списки доступа.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /users.add/i })).toBeInTheDocument();
    expect(screen.getByTestId('users-table-stub')).toBeInTheDocument();
  });

  it('renders the table in a full-width wrap', () => {
    render(<UsersPage />);
    expect(screen.getByTestId('users-table-stub')).toBeInTheDocument();
  });

  it('opens create modal from the page CTA', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByRole('button', { name: /users.add/i }));

    expect(openCreateModal).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'usersPage/openCreateModal' });
  });
});
