import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ServiceRequestsTable } from './ServiceRequestsTable';

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

vi.mock('@/shared/api/endpoints/serviceRequestApi', () => ({
  useGetServiceRequestsQuery: vi.fn(() => ({
    data: {
      rows: [{
        uid: 1,
        request_number: 'SR-1',
        call_received_at: '2026-09-01T10:00:00Z',
        operator_name: 'Ivan',
        counterparty_name: 'Client',
        account_or_inn: '100',
        phone: '7900',
        topic: 'Water',
        territorial_zone: 'A',
        locality: 'City',
        district: 'D',
        address: 'Street',
        comment: 'Leak',
        schedule_comment: null,
        request_status: 'new',
        sms_status: 'not_sent',
        call_uniqueid: null,
      }],
      count: 1,
    },
    isLoading: false,
  })),
  useLazyGetServiceRequestsQuery: vi.fn(() => [vi.fn()]),
  useDeleteServiceRequestMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('../ServiceRequestModal', () => ({
  ServiceRequestModal: () => null,
}));

vi.mock('./useServiceRequestsTableColumns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useServiceRequestsTableColumns')>();
  return {
    ...actual,
    useServiceRequestsTableColumns: () => [
      { accessorKey: 'request_number', header: 'No' },
    ],
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="service-requests-datatable">table</div>,
  };
});

describe('ServiceRequestsTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<ServiceRequestsTable filters={{}} />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('service-requests-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<ServiceRequestsTable filters={{}} />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('service-requests-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('SR-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toHaveAttribute('title', 'common.edit');
    expect(screen.getByRole('button', { name: 'common.delete' })).toHaveAttribute('title', 'common.delete');
  });
});
