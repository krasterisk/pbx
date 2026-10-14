import { downloadCsv } from "@/shared/lib/csv";
import { Button } from "@/shared/ui/Button";
import { HStack } from "@/shared/ui/Stack";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import cls from "./Table.module.scss";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableMarkup as UITable,
} from "./TableMarkup";
import { useTenantTablePageSize } from "./TablePageSizeContext";
import { TableToolbar, type TableToolbarProps } from "./TableToolbar";
import { tableCsv } from "./tableCsv";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableProps<TData> {
  surface?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  onGlobalFilterChange?: (value: string) => void;
  toolbar?: Omit<
    TableToolbarProps<TData>,
    "searchValue" | "onSearchChange" | "showSearch" | "showExport"
  >;
  onExport?: () => void;
  /** Data array to render */
  data: TData[];
  /** TanStack column definitions */
  columns: ColumnDef<TData, any>[];
  /** Stable row ID accessor; defaults to the row index. Set for persistent selection. */
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
  /**
   * CSV field separator. Default `;` for Excel RU/EU locale (comma is decimal separator).
   * Use `,` only when exporting for US/UK Excel or external APIs that expect RFC 4180 comma CSV.
   */
  csvDelimiter?: string;
  /** CSV field enclosure character (default `"`) */
  csvEnclosure?: string;
  /** Render slot above the table (header area) - receives the table instance */
  renderHeader?: (table: Table<TData>) => React.ReactNode;
  /** Custom row className based on row data */
  getRowClassName?: (row: TData) => string;
  /** Aria-label for the header “select page” checkbox */
  selectAllAriaLabel?: string;
  selectRowAriaLabel?: (row: TData) => string;
  /** Row click (journal and other non-CRUD lists). */
  onRowClick?: (row: TData) => void;
  /** Keep built-in or permission-restricted rows inactive. */
  canActivateRow?: (row: TData) => boolean;
  getRowAriaLabel?: (row: TData) => string;
  /** Stable test id for a data row. */
  getRowTestId?: (row: TData) => string;
  /**
   * Inline detail under a row. Return null when the row is collapsed.
   * Clicks inside the detail do not toggle the parent row.
   */
  renderExpandedRow?: (row: TData) => React.ReactNode;

  // ─── Server-side pagination ────────────────────────────────
  /**
   * Pagination mode:
   * - 'client' (default): TanStack handles pagination internally
   * - 'server': parent controls page state, DataTable shows all provided rows as-is
   */
  paginationMode?: "client" | "server";
  /** Total row count from server (required for server mode) */
  totalRows?: number;
  /** Current page index, 0-based (required for server mode) */
  currentPage?: number;
  /** Callback when user changes page (required for server mode) */
  onPageChange?: (page: number) => void;
}

export type DataTableExportRows = "filtered" | "selected";

export interface DataTableExportCsvOptions {
  /**
   * - `filtered` (default): all rows in the current filtered set (all pages).
   * - `selected`: selected rows only; if none selected, falls back to filtered
   *   so an empty selection never produces an empty CSV.
   */
  rows?: DataTableExportRows;
}

export interface DataTableRef {
  exportCsv: (options?: DataTableExportCsvOptions) => void;
  /** Select every row in the current filtered set (all pages). */
  selectAllFiltered: () => void;
  /** Clear row selection. */
  clearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Pagination Controls - Client-side
// ---------------------------------------------------------------------------

function ClientPaginationControls<TData>({ table }: { table: Table<TData> }) {
  const { t } = useTranslation();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;

  if (totalRows <= pageSize) return null; // No pagination needed for small datasets

  return (
    <HStack
      justify="between"
      align="center"
      className="px-4 py-3 border-t border-border"
    >
      <span className="text-xs text-muted-foreground">
        {t("common.tableRange", {
          start: pageIndex * pageSize + 1,
          end: Math.min((pageIndex + 1) * pageSize, totalRows),
          total: totalRows,
        })}
      </span>
      <HStack gap="4" align="center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("common.firstPage")}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("common.previousPage")}
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
          aria-label={t("common.nextPage")}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("common.lastPage")}
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
// Pagination Controls - Server-side
// ---------------------------------------------------------------------------

interface ServerPaginationProps {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

function ServerPaginationControls({
  currentPage,
  pageSize,
  totalRows,
  onPageChange,
}: ServerPaginationProps) {
  const pageCount = Math.ceil(totalRows / pageSize);
  if (pageCount <= 1) return null;

  const canPrev = currentPage > 0;
  const canNext = currentPage < pageCount - 1;

  return (
    <HStack
      justify="between"
      align="center"
      className="px-4 py-3 border-t border-border"
    >
      <span className="text-xs text-muted-foreground">
        {currentPage * pageSize + 1}–
        {Math.min((currentPage + 1) * pageSize, totalRows)} из {totalRows}
      </span>
      <HStack gap="4" align="center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(0)}
          disabled={!canPrev}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-foreground font-medium min-w-[60px] text-center">
          {currentPage + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(pageCount - 1)}
          disabled={!canNext}
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
    surface = true,
    showSearch = true,
    showExport = true,
    onGlobalFilterChange,
    toolbar,
    onExport,
    getRowId,
    selectable = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    globalFilter: controlledGlobalFilter,
    pageSize = 50,
    emptyText = "Нет данных",
    className,
    exportFilename = "export",
    csvDelimiter = ";",
    csvEnclosure = '"',
    renderHeader,
    getRowClassName,
    selectAllAriaLabel,
    selectRowAriaLabel,
    onRowClick,
    canActivateRow,
    getRowAriaLabel,
    getRowTestId,
    renderExpandedRow,
    paginationMode = "client",
    totalRows: serverTotalRows,
    currentPage: serverCurrentPage,
    onPageChange: serverOnPageChange,
  }: DataTableProps<TData>,
  ref: React.Ref<DataTableRef>,
) {
  const isServerMode = paginationMode === "server";
  const tenantPageSize = useTenantTablePageSize();
  const effectivePageSize =
    !isServerMode && tenantPageSize != null ? tenantPageSize : pageSize;

  const [internalFilter, setInternalFilter] = useState("");
  const filterValue = controlledGlobalFilter ?? internalFilter;
  const changeFilter = (value: string) => {
    setInternalFilter(value);
    onGlobalFilterChange?.(value);
    if (!isServerMode)
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  };
  const { t } = useTranslation();
  const [internalSorting, setSorting] = useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: effectivePageSize,
  });

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: effectivePageSize }));
  }, [effectivePageSize]);
  React.useEffect(() => {
    if (!isServerMode)
      setPagination((previous) =>
        previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
      );
  }, [filterValue, isServerMode]);

  // Support both controlled and uncontrolled row selection
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange = useCallback(
    (
      updater:
        | RowSelectionState
        | ((old: RowSelectionState) => RowSelectionState),
    ) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
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
      globalFilter: filterValue,
      rowSelection,
      // In server mode, show all rows on the page (no client-side pagination)
      ...(isServerMode ? {} : { pagination }),
    },
    onSortingChange: setSorting,
    onPaginationChange: isServerMode ? undefined : setPagination,
    onRowSelectionChange: handleRowSelectionChange as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Only use client pagination model when in client mode
    ...(isServerMode ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    enableRowSelection: selectable,
    getRowId: getRowId as any,
    autoResetPageIndex: false,
    // Tell TanStack the total row count for server mode (informational)
    ...(isServerMode && serverTotalRows ? { rowCount: serverTotalRows } : {}),
    manualPagination: isServerMode,
  });

  const selectAllFiltered = useCallback(() => {
    const source = table.getPrePaginationRowModel().rows;
    const next: RowSelectionState = {};
    for (const row of source) {
      next[row.id] = true;
    }
    handleRowSelectionChange(next);
  }, [table, handleRowSelectionChange]);

  const clearSelection = useCallback(() => {
    handleRowSelectionChange({});
  }, [handleRowSelectionChange]);

  const exportToCsv = useCallback(
    (options?: DataTableExportCsvOptions) => {
      downloadCsv(
        tableCsv(
          table,
          options?.rows === "selected",
          csvDelimiter,
          csvEnclosure,
        ),
        `${exportFilename}.csv`,
      );
    },
    [table, exportFilename, csvDelimiter, csvEnclosure],
  );

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    exportCsv: exportToCsv,
    selectAllFiltered,
    clearSelection,
  }));

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  const isAllPageSelected = table.getIsAllPageRowsSelected();
  const isSomePageSelected = table.getIsSomePageRowsSelected();

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        isSomePageSelected && !isAllPageSelected;
    }
  }, [isSomePageSelected, isAllPageSelected]);

  return (
    <div
      className={[surface && cls.surface, className].filter(Boolean).join(" ")}
    >
      {(showSearch ||
        showExport ||
        toolbar?.actions ||
        toolbar?.onCopySelected ||
        toolbar?.onDeleteSelected ||
        toolbar?.onSelectAll ||
        toolbar?.selection ||
        (toolbar?.onClearSelection &&
          Object.values(rowSelection).some(Boolean))) && (
        <div className={cls.toolbarPanel}>
          <TableToolbar
            {...toolbar}
            showSearch={showSearch}
            showExport={showExport}
            searchValue={filterValue}
            onSearchChange={changeFilter}
            selectedCount={Object.values(rowSelection).filter(Boolean).length}
            selectedItem={
              toolbar?.selectedItem ??
              table.getSelectedRowModel().rows[0]?.original
            }
            onSelectAll={
              toolbar?.onSelectAll ??
              (selectable ? () => toolbar?.selection
                ? toolbar.selection.selectAllMatching(table.getPrePaginationRowModel().rows.map((row) => row.id))
                : selectAllFiltered() : undefined)
            }
            selectAllDisabled={
              toolbar?.selectAllDisabled ||
              table.getFilteredRowModel().rows.every((row) => row.getIsSelected())
            }
            onClearSelection={
              toolbar?.onClearSelection ??
              toolbar?.selection?.clearSelection ??
              (selectable ? clearSelection : undefined)
            }
            exportLabel={
              toolbar?.exportLabel ??
              (isServerMode ? t("common.tableExportLoadedCsv") : undefined)
            }
            exportDisabled={!data.length || toolbar?.exportDisabled}
            onExport={
              onExport ??
              toolbar?.onExport ??
              (() => exportToCsv({ rows: "selected" }))
            }
          />
        </div>
      )}
      {/* Optional header slot */}
      {renderHeader && (
        <div className="px-4 py-3 border-b border-border">
          {renderHeader(table)}
        </div>
      )}

      {/* Table */}
      <UITable surface={false} showSearch={false} showExport={false}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="border-border">
              {selectable && (
                <TableHead className="px-4 py-3 w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                    aria-label={
                      selectAllAriaLabel ?? t("common.selectPageAria")
                    }
                    className="w-4 h-4 rounded border-border bg-background accent-primary cursor-pointer"
                  />
                </TableHead>
              )}
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none transition-colors"
                >
                  <HStack gap="4" align="center">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
                  </HStack>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center py-12 text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const expanded = renderExpandedRow?.(row.original);
              const colSpan = columns.length + (selectable ? 1 : 0);
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-testid={getRowTestId?.(row.original)}
                    data-selected={row.getIsSelected()}
                    aria-selected={selectable ? row.getIsSelected() : undefined}
                    aria-label={getRowAriaLabel?.(row.original)}
                    onActivate={
                      onRowClick && (canActivateRow?.(row.original) ?? true)
                        ? () => onRowClick(row.original)
                        : undefined
                    }
                    className={getRowClassName?.(row.original)}
                  >
                    {selectable && (
                      <TableCell
                        className="px-4 py-3 w-10 cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (event.target === event.currentTarget)
                            row.toggleSelected();
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={
                            selectRowAriaLabel?.(row.original) ??
                            t("common.tableSelectRow", {
                              number: row.index + 1,
                            })
                          }
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                          onClick={(event) => event.stopPropagation()}
                          className="w-4 h-4 rounded border-border bg-background accent-primary cursor-pointer"
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3 text-sm"
                        data-primary={
                          !!onRowClick && index === 0 ? "true" : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expanded ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell colSpan={colSpan} className="px-4 py-3">
                        {expanded}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </UITable>

      {/* Pagination */}
      {isServerMode &&
      serverTotalRows != null &&
      serverCurrentPage != null &&
      serverOnPageChange ? (
        <ServerPaginationControls
          currentPage={serverCurrentPage}
          pageSize={pageSize}
          totalRows={serverTotalRows}
          onPageChange={serverOnPageChange}
        />
      ) : (
        !isServerMode && <ClientPaginationControls table={table} />
      )}
    </div>
  );
}

// Cast to any first to work around generic forwardRef limitations in TS
export const TableDataView = React.forwardRef(DataTableInner) as <TData>(
  props: DataTableProps<TData> & { ref?: React.Ref<DataTableRef> },
) => ReturnType<typeof DataTableInner>;

(TableDataView as any).displayName = "TableDataView";
