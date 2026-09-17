import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IvrsTable } from './IvrsTable';

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

vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useGetIvrsQuery: vi.fn(() => ({
    data: [
      { uid: 1, name: 'Menu A', timeout: '5', max_count: 2 },
    ],
    isLoading: false,
  })),
  useDeleteIvrMutation: vi.fn(() => [vi.fn()]),
  useBulkDeleteIvrsMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('./useIvrsTableColumns', () => ({
  useIvrsTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'timeout', header: 'Timeout' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="ivrs-datatable">table</div>,
  };
});

describe('IvrsTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<IvrsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('ivrs-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<IvrsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('ivrs-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Menu A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
  });
});
