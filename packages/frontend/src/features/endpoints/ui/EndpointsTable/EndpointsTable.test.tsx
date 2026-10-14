import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EndpointsTable } from './EndpointsTable';

const useIsMobileMock = vi.fn((_bp?: number) => false);
const bulkDeleteMock = vi.fn(() => ({ unwrap: () => Promise.resolve({ deleted: 1, ids: [] }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      if (opts && typeof opts.ext === 'string') return `${key}:${opts.ext}`;
      if (opts && typeof opts.extensions === 'string') return `${key}:${opts.extensions}`;
      if (opts && typeof opts.remaining === 'number') return `${key}:remaining=${opts.remaining}`;
      if (opts && typeof opts.pageCount === 'number') return `${key}:${opts.pageCount}`;
      if (opts && typeof opts.total === 'number') return `${key}:${opts.total}`;
      return key;
    },
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
  useBulkDeleteEndpointsMutation: vi.fn(() => [bulkDeleteMock, { isLoading: false }]),
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
    Table: () => <div data-testid="endpoints-datatable">table</div>,
  };
});


function selectEntityForActions() {
  const checkbox = screen.getAllByRole("checkbox").find(element => element.closest("tbody") || element.closest("[data-table-activatable]")) as HTMLInputElement | undefined;
  if (!checkbox) throw new Error("Missing entity checkbox");
  if (!checkbox.checked) fireEvent.click(checkbox);
}

function getSelectedDeleteAction() {
  const button = document.querySelector<HTMLButtonElement>("[data-table-delete]");
  if (!button) throw new Error("Missing selected entity delete action");
  return button;
}

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
    expect(screen.getByTestId('endpoints-table-scroll')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'endpoints.btnSip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'endpoints.editRowAria:100' })).toBeInTheDocument();
    selectEntityForActions();
    expect(getSelectedDeleteAction()).toBeInTheDocument();
  });
});

describe('buildBulkDeletePreview wiring via EndpointsTable dialog', () => {
  it('does not put a giant extensions string into confirmBulkDelete title keys', async () => {
    // Preview helper is covered in bulkDeletePreview.test.ts;
    // this smoke-check ensures EndpointsTable still mounts with Dialog available.
    render(<EndpointsTable />);
    expect(screen.getByTestId('hybrid-table')).toBeInTheDocument();
    // Dialog closed by default — no confirmBulkDelete with extensions dump
    expect(screen.queryByText(/confirmBulkDeleteBody/)).not.toBeInTheDocument();
  });
});
