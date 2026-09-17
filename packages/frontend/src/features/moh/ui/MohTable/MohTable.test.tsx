import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MohTable } from './MohTable';

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

vi.mock('@/shared/api/endpoints/mohApi', () => ({
  useGetMohClassesQuery: vi.fn(() => ({
    data: [
      {
        name: 'moh_1_hold',
        displayName: 'Sales Hold',
        mode: 'files',
        sort: 'random',
        directory: '/var/lib/asterisk/moh',
        user_uid: 1,
        entries: [{ filename: 'hold.wav', position: 1 }],
      },
    ],
    isLoading: false,
  })),
  useDeleteMohClassMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useMohTableColumns', () => ({
  useMohTableColumns: () => [
    { accessorKey: 'displayName', header: 'Name' },
    { accessorKey: 'sort', header: 'Sort' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="moh-datatable">table</div>,
  };
});

describe('MohTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<MohTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('moh-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<MohTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('moh-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Sales Hold')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toHaveAttribute('title', 'common.edit');
    expect(screen.getByRole('button', { name: 'common.delete' })).toHaveAttribute('title', 'common.delete');
  });
});
