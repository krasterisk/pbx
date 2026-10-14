import {
  Copy,
  CheckCheck,
  Download,
  ListChecks,
  ListX,
  Search,
  Trash2,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Input } from "../Input";
import { Tooltip } from "../Tooltip/Tooltip";
import type { TableRef } from "./Table";
import cls from "./Table.module.scss";
import { downloadTableCsv, filteredTableRowIds, type TableExportConfig } from "./tableCsv";

/** A single controller for the desktop table, mobile cards and bulk actions. */
export interface TableToolbarSelection {
  selectedCount: number;
  selectedIds?: readonly string[];
  selectAllMatching: (ids?: readonly string[]) => void;
  clearSelection: () => void;
}

export interface TableToolbarProps<TData = unknown> {
  showSearch?: boolean;
  showExport?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchId?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  onExport?: () => void;
  tableRef?: RefObject<TableRef | null>;
  exportTable?: TableExportConfig<TData>;
  exportLabel?: string;
  exportDisabled?: boolean;
  disabled?: boolean;
  selectedCount?: number;
  selection?: TableToolbarSelection;
  /** Already filtered IDs for semantic/card lists without a TanStack model. */
  selectionRowIds?: readonly string[];
  onSelectAll?: () => void;
  selectAllDisabled?: boolean;
  onClearSelection?: () => void;
  selectAllLabel?: string;
  clearSelectionLabel?: string;
  actions?: ReactNode;
  selectedItem?: TData;
  onCopySelected?: (item: TData) => void;
  canCopySelected?: (item: TData) => boolean;
  copyDisabled?: boolean;
  copyLabel?: string;
  onDeleteSelected?: () => void;
  deleteDisabled?: boolean;
  deleteLabel?: string;
  className?: string;
}

export function TableToolbar<TData>({
  showSearch = true,
  showExport = true,
  searchValue = "",
  onSearchChange,
  searchId,
  searchPlaceholder,
  searchLabel,
  onExport,
  tableRef,
  exportTable,
  exportLabel,
  exportDisabled,
  disabled,
  selectedCount: suppliedSelectedCount = 0,
  selection,
  selectionRowIds,
  onSelectAll: suppliedSelectAll,
  selectAllDisabled,
  onClearSelection: suppliedClearSelection,
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
  className,
}: TableToolbarProps<TData>) {
  const { t } = useTranslation();
  const selectedCount = selection?.selectedCount ?? suppliedSelectedCount;
  const onSelectAll =
    suppliedSelectAll ??
    (selection && (selectionRowIds || exportTable || tableRef)
      ? () => selection.selectAllMatching(
          selectionRowIds ??
            (exportTable ? filteredTableRowIds(exportTable) : undefined),
        )
      : undefined);
  const onClearSelection = suppliedClearSelection ?? selection?.clearSelection;
  const countLabel = t("common.selectionBannerCount", { count: selectedCount });
  const selectedIds = Object.keys(exportTable?.rowSelection ?? {}).filter(
    (id) => exportTable?.rowSelection?.[id],
  );
  const matchingIds =
    selectionRowIds ??
    (selectedCount > 0 && exportTable ? filteredTableRowIds(exportTable) : undefined);
  const selectedIdSet = new Set(selection?.selectedIds ?? selectedIds);
  const allMatchingSelected =
    matchingIds !== undefined && matchingIds.every((id) => selectedIdSet.has(id));
  const item =
    selectedItem ??
    (selectedCount === 1 && selectedIds.length === 1
      ? exportTable?.data.find(
          (row, index) =>
            (exportTable.getRowId?.(row) ?? String(index)) === selectedIds[0],
        )
      : undefined);
  const showCopy =
    selectedCount === 1 &&
    item !== undefined &&
    onCopySelected &&
    (!canCopySelected || canCopySelected(item));
  const showDelete = selectedCount > 0 && onDeleteSelected;
  const csvLabel =
    exportLabel ??
    (selectedCount
      ? t("common.tableExportSelected", { count: selectedCount })
      : t("common.tableExportCsv"));
  if (
    !showSearch &&
    !showExport &&
    !onSelectAll &&
    !(selectedCount && onClearSelection) &&
    !actions &&
    !onCopySelected &&
    !onDeleteSelected
  )
    return null;
  return (
    <div
      className={[cls.toolbar, className].filter(Boolean).join(" ")}
      data-table-toolbar
    >
      <div
        className={cls.tools}
        data-table-tools
        aria-hidden={selectedCount === 0 || undefined}
        data-has-tools={selectedCount > 0}
      >
        <Tooltip content={countLabel}>
          <span
            className={cls.selectionCount}
            role="status"
            aria-label={countLabel}
            data-table-selection-count
          >
            <CheckCheck size={14} aria-hidden />
            <span>{selectedCount}</span>
          </span>
        </Tooltip>
        {showExport && (
          <Tooltip content={csvLabel}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cls.toolButton}
              aria-label={csvLabel}
              disabled={
                disabled ||
                exportDisabled ||
                (!onExport && !tableRef && !exportTable) ||
                (!onExport &&
                  exportTable != null &&
                  exportTable.data.length === 0)
              }
              onClick={() =>
                onExport
                  ? onExport()
                  : tableRef?.current
                    ? tableRef.current.exportCsv({ rows: "selected" })
                    : exportTable && downloadTableCsv(exportTable)
              }
            >
              <Download size={18} aria-hidden />
            </Button>
          </Tooltip>
        )}
        {onSelectAll && (
          <Tooltip content={selectAllLabel ?? t("common.tableSelectAll")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cls.toolButton}
              disabled={disabled || selectAllDisabled || allMatchingSelected}
              aria-label={selectAllLabel ?? t("common.tableSelectAll")}
              onClick={onSelectAll}
            >
              <ListChecks size={18} aria-hidden />
            </Button>
          </Tooltip>
        )}
        {onClearSelection && (
          <span className={cls.toolSlot} data-table-action-slot="clear">
            {!!selectedCount && (
              <Tooltip
                content={
                  clearSelectionLabel ?? t("common.selectionBannerClear")
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cls.toolButton}
                  aria-label={
                    clearSelectionLabel ?? t("common.selectionBannerClear")
                  }
                  disabled={disabled}
                  onClick={onClearSelection}
                >
                  <ListX size={18} aria-hidden />
                </Button>
              </Tooltip>
            )}
          </span>
        )}
        {onCopySelected && (
          <span className={cls.toolSlot} data-table-action-slot="copy">
            {showCopy && (
              <Tooltip content={copyLabel ?? t("common.copy")}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cls.toolButton}
                  data-table-copy
                  aria-label={copyLabel ?? t("common.copy")}
                  disabled={disabled || copyDisabled}
                  onClick={() => onCopySelected?.(item)}
                >
                  <Copy size={18} aria-hidden />
                </Button>
              </Tooltip>
            )}
          </span>
        )}
        {onDeleteSelected && (
          <span className={cls.toolSlot} data-table-action-slot="delete">
            {showDelete && (
              <Tooltip
                content={
                  deleteLabel ??
                  t("common.deleteSelected", { count: selectedCount })
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={[cls.toolButton, cls.deleteTool].join(" ")}
                  data-table-delete
                  aria-label={
                    deleteLabel ??
                    t("common.deleteSelected", { count: selectedCount })
                  }
                  disabled={disabled || deleteDisabled}
                  onClick={onDeleteSelected}
                >
                  <Trash2 size={18} aria-hidden />
                </Button>
              </Tooltip>
            )}
          </span>
        )}
        {actions}
      </div>
      {showSearch && (
        <div className={cls.search} data-table-search>
          <Search size={16} aria-hidden className={cls.searchIcon} />
          <Input
            id={searchId}
            type="search"
            value={searchValue}
            disabled={disabled}
            aria-label={searchLabel ?? searchPlaceholder ?? t("common.search")}
            placeholder={searchPlaceholder ?? t("common.search")}
            onChange={(event) => onSearchChange?.(event.target.value)}
            className={cls.searchInput}
          />
        </div>
      )}
    </div>
  );
}
