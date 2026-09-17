import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProvisionTemplatesTable } from './ProvisionTemplatesTable';

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
  useGetProvisionTemplatesQuery: vi.fn(() => ({
    data: [
      {
        uid: 1,
        name: 'Yealink T46S',
        vendor: 'Yealink',
        model: 'T46S',
        content: '<xml/>',
      },
    ],
    isLoading: false,
  })),
  useBulkDeleteProvisionTemplatesMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useDeleteProvisionTemplateMutation: vi.fn(() => [vi.fn()]),
}));

vi.mock('./useProvisionTemplatesTableColumns', () => ({
  useProvisionTemplatesTableColumns: () => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'vendor', header: 'Vendor' },
  ],
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    DataTable: () => <div data-testid="provision-templates-datatable">table</div>,
  };
});

describe('ProvisionTemplatesTable hybrid responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    useIsMobileMock.mockReturnValue(false);
    render(<ProvisionTemplatesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(screen.getByTestId('provision-templates-table-scroll')).toBeInTheDocument();
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<ProvisionTemplatesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByTestId('provision-templates-mobile-card')).toBeInTheDocument();
    expect(screen.getByText('Yealink T46S')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
  });
});
