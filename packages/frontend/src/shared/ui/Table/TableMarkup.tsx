import { classNames } from "@/shared/lib/classNames/classNames";
import { downloadCsv } from "@/shared/lib/csv";
import * as React from "react";
import { useTranslation } from "react-i18next";
import cls from "./Table.module.scss";
import { tableActivation } from "./tableActivation";
import { TableToolbar, type TableToolbarProps } from "./TableToolbar";

const SearchContext = React.createContext("");
export interface TableMarkupProps
  extends
    React.HTMLAttributes<HTMLTableElement>,
    Omit<TableToolbarProps, "className" | "tableRef"> {
  surface?: boolean;
  exportFilename?: string;
  wrapperClassName?: string;
}

export const TableMarkup = React.forwardRef<HTMLTableElement, TableMarkupProps>(
  (
    {
      className,
      children,
      surface = true,
      wrapperClassName,
      showSearch = true,
      showExport = true,
      searchValue,
      onSearchChange,
      searchId,
      searchPlaceholder,
      searchLabel,
      onExport,
      exportLabel,
      exportDisabled,
      disabled,
      selectedCount,
      selection,
      selectionRowIds,
      onSelectAll,
      selectAllDisabled,
      onClearSelection,
      selectAllLabel,
      clearSelectionLabel,
      actions,
      selectedItem,
      onCopySelected,
      canCopySelected,
      copyDisabled,
      copyLabel,
      onDeleteSelected,
      deleteDisabled,
      deleteLabel,
      exportTable,
      exportFilename = "table-export",
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const tableRef = React.useRef<HTMLTableElement>(null);
    React.useImperativeHandle(ref, () => tableRef.current!);
    const [localSearch, setLocalSearch] = React.useState("");
    const query = searchValue ?? localSearch;
    const exportMarkup = () => {
      const table = tableRef.current;
      if (!table) return;
      const headers = Array.from(
        table.tHead?.rows.item((table.tHead?.rows.length ?? 1) - 1)?.cells ??
          [],
      );
      const indexes = headers.flatMap((cell, index) =>
        cell.dataset.export === "false" ||
        !cell.textContent?.trim() ||
        cell.textContent.trim() === t("common.actions")
          ? []
          : [index],
      );
      const rows = Array.from(table.tBodies)
        .flatMap((body) => Array.from(body.rows))
        .filter((row) => !row.hidden && row.cells.length === headers.length);
      const selected = rows.filter(
        (row) =>
          row.dataset.selected === "true" || row.dataset.state === "selected",
      );
      const cellText = (cell: Element | undefined) => {
        if (!cell) return "";
        const switches = Array.from(
          cell.querySelectorAll('[role="switch"], input[type="checkbox"]'),
        );
        if (switches.length)
          return switches
            .map((control) =>
              (
                control instanceof HTMLInputElement
                  ? control.checked
                  : control.getAttribute("aria-checked") === "true"
              )
                ? t("common.yes")
                : t("common.no"),
            )
            .join(" · ");
        return cell.textContent?.replace(/\s+/g, " ").trim() ?? "";
      };
      const values = [
        indexes.map((index) => cellText(headers[index])),
        ...(selected.length ? selected : rows).map((row) =>
          indexes.map((index) => cellText(row.cells[index])),
        ),
      ];
      const csv =
        "\uFEFF" +
        values
          .map((row) =>
            row.map((value) => '"' + value.replace(/"/g, '""') + '"').join(";"),
          )
          .join("\n");
      downloadCsv(csv, `${exportFilename}.csv`);
    };
    return (
      <div
        className={classNames(surface ? cls.surface : "", {}, [
          wrapperClassName ?? "",
        ])}
      >
        {(showSearch ||
          showExport ||
          actions ||
          onCopySelected ||
          onDeleteSelected ||
          onSelectAll ||
          selection ||
          (selectedCount && onClearSelection)) && (
          <div className={cls.toolbarPanel}>
            <TableToolbar
              showSearch={showSearch}
              showExport={showExport}
              searchValue={query}
              onSearchChange={onSearchChange ?? setLocalSearch}
              searchId={searchId}
              searchPlaceholder={searchPlaceholder}
              searchLabel={searchLabel}
              onExport={onExport ?? (exportTable ? undefined : exportMarkup)}
              exportTable={exportTable}
              exportLabel={exportLabel}
              exportDisabled={exportDisabled}
              disabled={disabled}
              selectedCount={selectedCount}
            selection={selection}
            selectionRowIds={selectionRowIds}
              onSelectAll={onSelectAll}
              selectAllDisabled={selectAllDisabled}
              onClearSelection={onClearSelection}
              selectAllLabel={selectAllLabel}
              clearSelectionLabel={clearSelectionLabel}
              actions={actions}
              selectedItem={selectedItem}
              onCopySelected={onCopySelected}
              canCopySelected={canCopySelected}
              copyDisabled={copyDisabled}
              copyLabel={copyLabel}
              onDeleteSelected={onDeleteSelected}
              deleteDisabled={deleteDisabled}
              deleteLabel={deleteLabel}
            />
          </div>
        )}
        <div className={cls.scroll}>
          <SearchContext.Provider
            value={
              showSearch && !onSearchChange
                ? query.trim().toLocaleLowerCase()
                : ""
            }
          >
            <table
              ref={tableRef}
              className={classNames(cls.table, {}, [className ?? ""])}
              {...props}
            >
              {children}
            </table>
          </SearchContext.Provider>
        </div>
      </div>
    );
  },
);
TableMarkup.displayName = "TableMarkup";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={classNames(cls.header, {}, [className ?? ""])}
    {...props}
  />
));
export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={classNames(cls.body, {}, [className ?? ""])}
    {...props}
  />
));
export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={classNames(cls.footer, {}, [className ?? ""])}
    {...props}
  />
));
export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { onActivate?: () => void }
>(
  (
    { className, hidden, children, onActivate, onClick, onKeyDown, ...props },
    ref,
  ) => {
    const rowRef = React.useRef<HTMLTableRowElement>(null);
    React.useImperativeHandle(ref, () => rowRef.current!);
    const query = React.useContext(SearchContext);
    const [filteredOut, setFilteredOut] = React.useState(false);
    React.useLayoutEffect(() => {
      const row = rowRef.current;
      setFilteredOut(
        !!query &&
          !!row?.closest("tbody") &&
          !(row.textContent ?? "").toLocaleLowerCase().includes(query),
      );
    }, [query, children]);
    return (
      <tr
        ref={rowRef}
        data-table-activatable={onActivate ? "true" : undefined}
        hidden={hidden || filteredOut}
        className={classNames(cls.row, { [cls.interactive]: !!onActivate }, [
          className ?? "",
        ])}
        {...tableActivation(onActivate, { onClick, onKeyDown })}
        {...props}
      >
        {children}
      </tr>
    );
  },
);
export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { exportable?: boolean }
>(({ className, exportable, ...props }, ref) => (
  <th
    ref={ref}
    data-export={exportable === false ? "false" : undefined}
    className={classNames(cls.head, {}, [className ?? ""])}
    {...props}
  />
));
export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={classNames(cls.cell, {}, [className ?? ""])}
    {...props}
  />
));
export function TableSelectionCell({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <TableCell
      className={cls.selectionCell}
      data-table-no-activate
      onClick={() => onCheckedChange(!checked)}
    >
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onCheckedChange(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
    </TableCell>
  );
}

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={classNames(cls.caption, {}, [className ?? ""])}
    {...props}
  />
));
for (const [component, name] of [
  [TableHeader, "TableHeader"],
  [TableBody, "TableBody"],
  [TableFooter, "TableFooter"],
  [TableRow, "TableRow"],
  [TableHead, "TableHead"],
  [TableCell, "TableCell"],
  [TableCaption, "TableCaption"],
] as const)
  component.displayName = name;
