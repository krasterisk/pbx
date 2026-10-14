import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { contextsActions } from "../../model/slice/contextsSlice";

import {
  useBulkDeleteContextsMutation,
  useGetContextsQuery,
} from "@/shared/api/api";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack } from "@/shared/ui/Stack";

import { Loader2, Network } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import cls from "./ContextsTable.module.scss";
import { useContextsTableColumns } from "./useContextsTableColumns";

const PAGE_SIZE = 50;

export const ContextsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    data: contexts = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetContextsQuery();
  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteContextsMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useContextsTableColumns();
  // TanStack caches accessor values per row. Refresh rows when translations
  // change so the purpose labels and CSV export use the current language.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t intentionally invalidates the row-value cache.
  const tableData = useMemo(() => [...contexts], [contexts, t]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = contexts.find((c) => String(c.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, contexts],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Network size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("contexts.count", {
            count: contexts.length,
            defaultValue: `Всего: ${contexts.length}`,
          })}
        </Text>
      </HStack>
      <HStack gap="12" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="contexts-search"
          searchPlaceholder={t("common.search", "Поиск...")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: tableData,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "contexts_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("common.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
      </HStack>
    </Flex>
  );

  if (isListLoadError)
    return (
      <QueryErrorState
        message={t("common.queryLoadError")}
        onRetry={() => void retryListLoad()}
      />
    );
  if (isLoading) {
    return (
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={[tableStyles.surface, cls.card].join(" ")}
      data-testid="contexts-table"
    >
      <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex direction="column" align="stretch" className={cls.tableScroll}>
          <Table
            onRowClick={(row) => dispatch(contextsActions.openEditModal(row))}
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={tableData}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("common.noData")}
            exportFilename="contexts_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

ContextsTable.displayName = "ContextsTable";
