import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type RowSelectionState } from '@tanstack/react-table';
import { type DataTableRef } from '@/shared/ui/DataTable/DataTable';

export function selectedIdsFromState(rowSelection: RowSelectionState): string[] {
  return Object.keys(rowSelection).filter((id) => rowSelection[id]);
}

export interface UseCrossPageRowSelectionOptions {
  /** Current search / global filter value — resets “all matching” when it changes. */
  globalFilter: string;
}

/**
 * Controlled row selection with cross-page persistence and Gmail-style
 * “select all matching” mode (ARCHITECTURE §4.2.1).
 */
export function useCrossPageRowSelection({ globalFilter }: UseCrossPageRowSelectionOptions) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const tableRef = useRef<DataTableRef>(null);
  const prevFilterRef = useRef(globalFilter);
  const selectingAllMatchingRef = useRef(false);

  const selectedIds = useMemo(() => selectedIdsFromState(rowSelection), [rowSelection]);
  const selectedCount = selectedIds.length;

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

  const selectAllMatching = useCallback(() => {
    selectingAllMatchingRef.current = true;
    tableRef.current?.selectAllFiltered();
    setAllMatchingSelected(true);
    selectingAllMatchingRef.current = false;
  }, []);

  const clearSelection = useCallback(() => {
    tableRef.current?.clearSelection();
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
    allMatchingSelected,
    selectAllMatching,
    clearSelection,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    openBulkDelete,
    afterBulkDelete,
  };
}
