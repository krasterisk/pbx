import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DirectoriesTable } from './DirectoriesTable';

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

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoriesQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        name: 'Clients',
        description: 'Lookup by phone',
        fields: [{ key: 'phone' }],
        records: [{ phone: '7900' }],
      },
    ],
    isLoading: false,
  })),
  useDeleteDirectoryMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useDirectoriesTableColumns', () => ({
  useDirectoriesTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'description', header: 'Description' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="directories-datatable">table</div>,
  };
});

describe('DirectoriesTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<DirectoriesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('directories-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<DirectoriesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('directories-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toHaveAttribute('title', 'common.edit');
    expect(screen.getByRole('button', { name: 'common.copy' })).toHaveAttribute('title', 'common.copy');
    expect(screen.getByRole('button', { name: 'common.delete' })).toHaveAttribute('title', 'common.delete');
  });
});
