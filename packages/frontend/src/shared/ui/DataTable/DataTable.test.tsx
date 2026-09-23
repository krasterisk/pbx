import { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { DataTable, type DataTableRef } from './DataTable';

type Row = { id: string; name: string };

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: 'name', header: 'Name' },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i + 1}`,
    name: `Row ${i + 1}`,
  }));
}

function ControlledTable({ data, pageSize = 2 }: { data: Row[]; pageSize?: number }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const ref = useRef<DataTableRef>(null);

  return (
    <>
      <button type="button" data-testid="select-all-filtered" onClick={() => ref.current?.selectAllFiltered()}>
        select-all-filtered
      </button>
      <button type="button" data-testid="clear-selection" onClick={() => ref.current?.clearSelection()}>
        clear
      </button>
      <button type="button" data-testid="export-filtered" onClick={() => ref.current?.exportCsv()}>
        export-filtered
      </button>
      <button
        type="button"
        data-testid="export-selected"
        onClick={() => ref.current?.exportCsv({ rows: 'selected' })}
      >
        export-selected
      </button>
      <button type="button" data-testid="go-next-page" onClick={() => {
        // Drive pagination via table ref is not exposed; click the next chevron in the DOM.
        const buttons = screen.getAllByRole('button');
        const iconButtons = buttons.filter((b) => !b.getAttribute('data-testid') && b.querySelector('svg'));
        // ClientPaginationControls order: first, prev, next, last
        fireEvent.click(iconButtons[2]);
      }}>
        go-next
      </button>
      <DataTable
        ref={ref}
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        selectable
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        pageSize={pageSize}
        selectAllAriaLabel="Select page"
        exportFilename="test-export"
        renderBanner={(table) => (
          <div data-testid="banner">
            selected=
            {Object.keys(table.getState().rowSelection).filter((k) => table.getState().rowSelection[k]).length}
            {' '}
            filtered={table.getFilteredRowModel().rows.length}
            {' '}
            page={table.getRowModel().rows.length}
          </div>
        )}
      />
    </>
  );
}

describe('shared/ui/DataTable selection + export', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let lastBlob: Blob | null;

  beforeEach(() => {
    lastBlob = null;
    createObjectURL = vi.fn((blob: Blob) => {
      lastBlob = blob;
      return 'blob:test';
    });
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  async function readLastCsv(): Promise<string> {
    expect(lastBlob).not.toBeNull();
    return lastBlob!.text();
  }

  it('keeps row selection across pages (header selects current page only)', async () => {
    const data = makeRows(5);
    render(<ControlledTable data={data} pageSize={2} />);

    fireEvent.click(screen.getByLabelText('Select page'));
    expect(screen.getByTestId('banner')).toHaveTextContent('selected=2');

    fireEvent.click(screen.getByTestId('go-next-page'));

    await waitFor(() => {
      expect(screen.getByText('Row 3')).toBeInTheDocument();
    });

    expect(screen.getByTestId('banner')).toHaveTextContent('selected=2');
    expect(screen.getByLabelText('Select page')).not.toBeChecked();

    // Row checkboxes: header + page rows. Select first data row on page 2.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(screen.getByTestId('banner')).toHaveTextContent('selected=3');
  });

  it('selectAllFiltered selects every filtered row across pages', () => {
    const data = makeRows(5);
    render(<ControlledTable data={data} pageSize={2} />);

    fireEvent.click(screen.getByTestId('select-all-filtered'));
    expect(screen.getByTestId('banner')).toHaveTextContent('selected=5');
    expect(screen.getByTestId('banner')).toHaveTextContent('filtered=5');

    fireEvent.click(screen.getByTestId('clear-selection'));
    expect(screen.getByTestId('banner')).toHaveTextContent('selected=0');
  });

  it('exportCsv without selection exports all filtered rows (not just current page)', async () => {
    const data = makeRows(5);
    render(<ControlledTable data={data} pageSize={2} />);

    fireEvent.click(screen.getByTestId('export-filtered'));
    const csv = await readLastCsv();
    expect(csv).toContain('Row 1');
    expect(csv).toContain('Row 5');
    expect(csv.split('\n').length).toBe(6);
  });

  it('exportCsv({ rows: "selected" }) exports only selected; empty selection falls back to all', async () => {
    const data = makeRows(5);
    render(<ControlledTable data={data} pageSize={2} />);

    fireEvent.click(screen.getByTestId('export-selected'));
    let csv = await readLastCsv();
    expect(csv.split('\n').length).toBe(6);

    fireEvent.click(screen.getByLabelText('Select page'));
    lastBlob = null;
    fireEvent.click(screen.getByTestId('export-selected'));
    csv = await readLastCsv();
    expect(csv).toContain('Row 1');
    expect(csv).toContain('Row 2');
    expect(csv).not.toContain('Row 3');
    expect(csv.split('\n').length).toBe(3);
  });

  it('renders selection banner slot', () => {
    render(<ControlledTable data={makeRows(3)} pageSize={2} />);
    expect(screen.getByTestId('banner')).toBeInTheDocument();
    expect(screen.getByTestId('banner')).toHaveTextContent('page=2');
  });
});
