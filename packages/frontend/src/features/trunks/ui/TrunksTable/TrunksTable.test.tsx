import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrunksTable } from './TrunksTable';

const useIsMobileMock = vi.fn(() => false);

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

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: vi.fn(() => ({
    data: [
      {
        id: 't1',
        name: 'Trunk-A',
        trunkType: 'auth',
        host: 'sip.example.com',
        context: 'from-trunk',
        transport: 'transport-udp',
        codecs: 'ulaw,alaw',
        username: 'user1',
        fromUser: '',
        fromDomain: '',
        contactUser: '',
        matchIp: '',
        registrationStatus: 'Registered',
        serverUri: '',
        clientUri: '',
      },
    ],
    isLoading: false,
  })),
  useBulkDeleteTrunksMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteTrunkMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useTrunksTableColumns', () => ({
  useTrunksTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'host', header: 'Host' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="trunks-datatable">table</div>,
  };
});

describe('TrunksTable hybrid responsive (D-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<TrunksTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('trunks-table-scroll')).toHaveClass('overflow-x-auto');
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<TrunksTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('trunks-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Trunk-A')).toBeInTheDocument();
    expect(screen.getByText('sip.example.com')).toBeInTheDocument();
  });
});
