import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimeGroupsTable } from './TimeGroupsTable';

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

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        name: 'Business Hours',
        comment: 'Weekdays',
        intervals: [
          {
            time_start: '09:00',
            time_end: '18:00',
            days_of_week: 'mon-fri',
            days_of_month: '*',
            months: '*',
          },
        ],
        user_uid: 1,
      },
    ],
    isLoading: false,
  })),
  useBulkDeleteTimeGroupsMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteTimeGroupMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useTimeGroupsTableColumns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useTimeGroupsTableColumns')>();
  return {
    ...actual,
    useTimeGroupsTableColumns: () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'comment', header: 'Comment' },
    ],
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="timegroups-datatable">table</div>,
  };
});

describe('TimeGroupsTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<TimeGroupsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('timegroups-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<TimeGroupsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('timegroups-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Business Hours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
  });
});
