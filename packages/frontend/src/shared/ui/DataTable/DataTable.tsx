import React, { useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type Table,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { HStack } from '@/shared/ui/Stack';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableProps<TData> {
  /** Data array to render */
  data: TData[];
  /** TanStack column definitions */
  columns: ColumnDef<TData, any>[];
  /** Unique row id accessor (defaults to 'id') */
  getRowId?: (row: TData) => string;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Controlled row selection state */
  rowSelection?: RowSelectionState;
  /** Row selection change callback */
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Global filter value (search) */
  globalFilter?: string;
  /** Number of rows per page (default: 50) */
  pageSize?: number;
  /** Text to show when no data */
  emptyText?: string;
  /** Optional class for the wrapper */
  className?: string;
  /** Filename for CSV export */
  exportFilename?: string;
  /** Render slot above the table (header area) — receives the table instance */
  renderHeader?: (table: Table<TData>) => React.ReactNode;
}

export interface DataTableRef {
  exportCsv: () => void;
}

// ---------------------------------------------------------------------------
// Pagination Controls
// ---------------------------------------------------------------------------

function PaginationControls<TData>({ table }: { table: Table<TData> }) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;

  if (totalRows <= pageSize) return null; // No pagination needed for small datasets

  return (
    <HStack justify="between" align="center" className="px-4 py-3 border-t border-border">
      <span className="text-xs text-muted-foreground">
        {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalRows)} из {totalRows}
      </span>
      <HStack gap="4" align="center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-foreground font-medium min-w-[60px] text-center">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </HStack>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// DataTable Component
// ---------------------------------------------------------------------------

function DataTableInner<TData>(
  {
    data,
    columns,
    getRowId,
    selectable = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    globalFilter: controlledGlobalFilter,
    pageSize = 50,
    emptyText = 'Нет данных',
    className,
    exportFilename = 'export',
    renderHeader,
  }: DataTableProps<TData>,
  ref: React.Ref<DataTableRef>
) {
  const [internalSorting, setSorting] = useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  // Update internal pagination if pageSize prop changes
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize }));
  }, [pageSize]);

  // Support both controlled and uncontrolled row selection
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      if (onRowSelectionChange) {
        onRowSelectionChange(next);
      } else {
        setInternalRowSelection(next);
      }
    },
    [rowSelection, onRowSelectionChange],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: internalSorting,
      globalFilter: controlledGlobalFilter ?? '',
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: handleRowSelectionChange as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectable,
    getRowId: getRowId as any,
    autoResetPageIndex: false,
  });

  const exportToCsv = useCallback(() => {
    // Get visible columns except actions and checkboxes
    const visibleColumns = table.getVisibleLeafColumns().filter((c) => c.id !== 'actions' && c.id !== 'select');
    
    // Header row
    const headers = visibleColumns.map((c) => {
      let headerStr = typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id;
      return `"${headerStr.replace(/"/g, '""')}"`;
    });

    // Data rows
    const rows = table.getFilteredRowModel().rows;
    const csvRows = rows.map((row) => {
      return visibleColumns.map((col) => {
        let val = row.getValue(col.id);
        if (val === null || val === undefined) val = '';
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(',');
    });

    // Combine and download (add BOM for Excel utf-8 recognition)
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [table, exportFilename]);

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    exportCsv: exportToCsv,
  }));

  return (
    <div className={className}>
      {/* Optional header slot */}
      {renderHeader && (
        <div className="px-4 py-3 border-b border-border">
          {renderHeader(table)}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {selectable && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={table.getIsAllPageRowsSelected()}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                      className="w-4 h-4 rounded border-border bg-background accent-primary cursor-pointer"
                    />
                  </th>
                )}
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none transition-colors"
                  >
                    <HStack gap="4" align="center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' ↑'}
                      {header.column.getIsSorted() === 'desc' && ' ↓'}
                    </HStack>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/50 transition-colors ${
                    row.getIsSelected()
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {selectable && (
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                        className="w-4 h-4 rounded border-border bg-background accent-primary cursor-pointer"
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <PaginationControls table={table} />
    </div>
  );
}

// Cast to any first to work around generic forwardRef limitations in TS
export const DataTable = React.forwardRef(DataTableInner) as <TData>(
  props: DataTableProps<TData> & { ref?: React.Ref<DataTableRef> }
) => ReturnType<typeof DataTableInner>;

(DataTable as any).displayName = 'DataTable';
