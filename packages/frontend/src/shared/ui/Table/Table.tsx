import * as React from "react";
import { TableMarkup, type TableMarkupProps } from "./TableMarkup";
import {
  TableDataView,
  type DataTableProps,
  type DataTableRef,
} from "./TableDataView";
export type TableProps<TData> = DataTableProps<TData>;
export type TableRef = DataTableRef;
export type { TableMarkupProps } from "./TableMarkup";
export type { TableToolbarProps, TableToolbarSelection } from "./TableToolbar";
export type { TableExportConfig } from "./tableCsv";
export { TableToolbar } from "./TableToolbar";
export { TableCard, TableCardDetails, type TableCardProps } from "./TableCard";
export {
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableSelectionCell,
  TableCaption,
} from "./TableMarkup";
export { default as tableStyles } from "./Table.module.scss";
/** One table API: data + columns for lists, children for existing semantic markup. */
function TableInner<TData>(
  props: DataTableProps<TData> | TableMarkupProps,
  ref: React.ForwardedRef<DataTableRef | HTMLTableElement>,
) {
  return "data" in props && "columns" in props ? (
    <TableDataView {...props} ref={ref as React.Ref<DataTableRef>} />
  ) : (
    <TableMarkup
      {...(props as TableMarkupProps)}
      ref={ref as React.Ref<HTMLTableElement>}
    />
  );
}
export const Table = React.forwardRef(TableInner) as {
  <TData>(
    props: DataTableProps<TData> & { ref?: React.Ref<DataTableRef> },
  ): React.ReactElement;
  (
    props: TableMarkupProps & { ref?: React.Ref<HTMLTableElement> },
  ): React.ReactElement;
  displayName?: string;
};
Table.displayName = "Table";
