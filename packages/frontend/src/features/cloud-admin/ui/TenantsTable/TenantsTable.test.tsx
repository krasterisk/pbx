import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TenantsTable } from './TenantsTable';

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

vi.mock('@/shared/api/endpoints/cloudAdminApi', () => ({
  useGetTenantsQuery: vi.fn(() => ({
    data: {
      rows: [{
        id: 1,
        uid: 't1',
        name: 'Acme',
        slug: 'acme',
        email: 'a@a.com',
        status: 'active',
        max_extensions: 10,
        max_trunks: 2,
        created_at: '2026-01-01T00:00:00Z',
      }],
      count: 1,
    },
    isLoading: false,
  })),
  useGetTenantStatsQuery: vi.fn(() => ({ data: undefined })),
  useSuspendTenantMutation: vi.fn(() => [vi.fn()]),
  useActivateTenantMutation: vi.fn(() => [vi.fn()]),
  useImpersonateTenantMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('../TenantDrawer/TenantDrawer', () => ({
  TenantDrawer: () => null,
}));

vi.mock('./useTenantsTableColumns', () => ({
  useTenantsTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="tenants-datatable">table</div>,
  };
});

describe('TenantsTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<TenantsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('tenants-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<TenantsTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('tenants-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });
});
