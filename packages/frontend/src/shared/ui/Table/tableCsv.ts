import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type RowSelectionState,
  type Table as RowModel,
} from "@tanstack/react-table";
import { downloadCsv } from "@/shared/lib/csv";

export interface TableExportConfig<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  getRowId?: (row: TData) => string;
  globalFilter?: string;
  rowSelection?: RowSelectionState;
  filename?: string;
  delimiter?: string;
  enclosure?: string;
}

export function tableCsv<TData>(
  table: RowModel<TData>,
  selected = false,
  delimiter = ";",
  enclosure = '"',
): string {
  const columns = table
    .getVisibleLeafColumns()
    .filter(
      (column) =>
        column.id !== "actions" &&
        column.id !== "select" &&
        column.columnDef.header !== "" &&
        (column.columnDef.meta as { exportable?: boolean } | undefined)
          ?.exportable !== false,
    );
  const selectedRows = selected ? table.getSelectedRowModel().rows : [];
  const rows = selectedRows.length
    ? selectedRows
    : table.getFilteredRowModel().rows;
  const escape = (value: unknown) => {
    const text =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    return `${enclosure}${text.split(enclosure).join(enclosure + enclosure)}${enclosure}`;
  };
  const header = columns.map((column) =>
    escape(
      typeof column.columnDef.header === "string"
        ? column.columnDef.header
        : column.id,
    ),
  );
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((row) =>
        columns.map((column) => escape(row.getValue(column.id))),
      ),
    ]
      .map((row) => row.join(delimiter))
      .join("\n")
  );
}

/** Same row model for desktop data, mobile selection and CSV. */
function createDataModel<TData>(
  config: TableExportConfig<TData>,
): RowModel<TData> {
  return createTable<TData>({
    data: config.data,
    columns: config.columns,
    getRowId: config.getRowId,
    state: {
      globalFilter: config.globalFilter ?? "",
      rowSelection: config.rowSelection ?? {},
    },
    onStateChange: () => undefined,
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
}

export function filteredTableRowIds<TData>(config: TableExportConfig<TData>): string[] {
  return createDataModel(config).getFilteredRowModel().rows.map((row) => row.id);
}

/** Resolve the same accessors/filter/selection for mobile cards where no table is mounted. */
export function downloadTableCsv<TData>(config: TableExportConfig<TData>): void {
  const table = createDataModel(config);
  downloadCsv(
    tableCsv(table, true, config.delimiter, config.enclosure),
    `${config.filename ?? "table-export"}.csv`,
  );
}
