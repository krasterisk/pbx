import { type TableRef } from "@/shared/ui/Table/Table";
import { type RowSelectionState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function selectedIdsFromState(
  rowSelection: RowSelectionState,
): string[] {
  return Object.keys(rowSelection).filter((id) => rowSelection[id]);
}

export interface UseCrossPageRowSelectionOptions {
  /** Current search / global filter value — resets “all matching” when it changes. */
  globalFilter: string;
}

/**
 * Controlled cross-page selection shared by the table, cards and toolbar
 * (ARCHITECTURE §4.2.1).
 */
export function useCrossPageRowSelection({
  globalFilter,
}: UseCrossPageRowSelectionOptions) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const tableRef = useRef<TableRef>(null);
  const prevFilterRef = useRef(globalFilter);
  const selectingAllMatchingRef = useRef(false);

  const selectedIds = useMemo(
    () => selectedIdsFromState(rowSelection),
    [rowSelection],
  );
  const selectedCount = selectedIds.length;
  const cardSelection = useCallback(
    (id: string, label?: string) => ({
      checked: !!rowSelection[id],
      label,
      onCheckedChange: (checked: boolean) => {
        setAllMatchingSelected(false);
        setRowSelection((state) => ({ ...state, [id]: checked }));
      },
    }),
    [rowSelection],
  );

  useEffect(() => {
    if (prevFilterRef.current === globalFilter) return;
    prevFilterRef.current = globalFilter;
    if (allMatchingSelected) {
      setAllMatchingSelected(false);
      setRowSelection({});
    }
  }, [globalFilter, allMatchingSelected]);

  const onRowSelectionChange = useCallback((next: RowSelectionState) => {
    if (!selectingAllMatchingRef.current) {
      setAllMatchingSelected(false);
    }
    setRowSelection(next);
  }, []);

  const selectAllMatching = useCallback((ids?: readonly string[]) => {
    if (ids) {
      setRowSelection(Object.fromEntries(ids.map((id) => [id, true])));
      setAllMatchingSelected(ids.length > 0);
      return;
    }
    if (!tableRef.current) return;
    selectingAllMatchingRef.current = true;
    tableRef.current.selectAllFiltered();
    setAllMatchingSelected(true);
    selectingAllMatchingRef.current = false;
  }, []);

  const clearSelection = useCallback(() => {
    tableRef.current?.clearSelection();
    setRowSelection({});
    setAllMatchingSelected(false);
  }, []);

  const openBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setBulkDeleteOpen(true);
  }, [selectedCount]);

  const afterBulkDelete = useCallback(() => {
    setRowSelection({});
    setAllMatchingSelected(false);
    setBulkDeleteOpen(false);
  }, []);

  return {
    tableRef,
    rowSelection,
    onRowSelectionChange,
    selectedIds,
    selectedCount,
    cardSelection,
    allMatchingSelected,
    selectAllMatching,
    clearSelection,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    openBulkDelete,
    afterBulkDelete,
  };
}
