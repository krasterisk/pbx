import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EndpointsTable } from './EndpointsTable';

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

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({
    data: [
      {
        id: 'e100',
        extension: '100',
        callerid: '"Alice" <100>',
        department: 'Sales',
        context: 'from-internal',
        status: 'online',
        webrtc_enabled: false,
      },
    ],
    isLoading: false,
  })),
  useBulkDeleteEndpointsMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteEndpointMutation: vi.fn(() => [vi.fn()]),
  useGetActiveBulkJobQuery: vi.fn(() => ({ data: { jobId: null } })),
  useGetBulkJobStatusQuery: vi.fn(() => ({ data: undefined })),
}));

vi.mock('./useEndpointsTableColumns', () => ({
  useEndpointsTableColumns: () => [
    { accessorKey: 'extension', header: 'Ext' },
    { accessorKey: 'callerid', header: 'Caller' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="endpoints-datatable">table</div>,
  };
});

describe('EndpointsTable hybrid responsive (D-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<EndpointsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('endpoints-table-scroll')).toHaveClass('overflow-x-auto');
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<EndpointsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('endpoints-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
