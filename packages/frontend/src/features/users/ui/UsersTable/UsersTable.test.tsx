import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UsersTable } from './UsersTable';

const useIsMobileMock = vi.fn((_bp?: number) => false);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count != null ? `${key}:${opts.count}` : key,
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/api/api', () => ({
  useGetUsersQuery: vi.fn(() => ({
    data: [
      {
        uniqueid: 1,
        login: 'admin',
        name: 'Admin User',
        email: 'admin@example.com',
        exten: '100',
        level: 1,
        role: 1,
        numbers_id: 0,
      },
    ],
    isLoading: false,
  })),
  useGetRolesQuery: vi.fn(() => ({ data: [{ id: 1, name: 'Admin' }] })),
  useGetNumbersQuery: vi.fn(() => ({ data: [] })),
  useBulkDeleteUsersMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteUserMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useUsersTableColumns', () => ({
  useUsersTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="users-datatable">table</div>,
  };
});

describe('UsersTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<UsersTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('users-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<UsersTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('users-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
  });
});
