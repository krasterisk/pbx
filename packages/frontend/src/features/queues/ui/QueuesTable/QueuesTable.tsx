import { TableCard } from "@/shared/ui";

import {
  useDeleteQueueMutation,
  useGetQueuesQuery,
} from "@/shared/api/endpoints/queueApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { ListOrdered, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { queuesPageActions } from "../../model/slice/queuesPageSlice";
import cls from "./QueuesTable.module.scss";
import {
  formatQueueStrategy,
  useQueuesTableColumns,
} from "./useQueuesTableColumns";

const PAGE_SIZE = 50;

export const QueuesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: queues = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetQueuesQuery();
  const [deleteQueue] = useDeleteQueueMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useQueuesTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return queues;
    return queues.filter((row) => {
      const exten = (row.exten || row.name || "").toLowerCase();
      const display = (row.display_name || "").toLowerCase();
      const strategy = (row.strategy || "").toLowerCase();
      return exten.includes(q) || display.includes(q) || strategy.includes(q);
    });
  }, [queues, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = queues.find((q) => q.name === id);
        return row?.display_name || row?.exten || row?.name || id;
      }),
    [selection.selectedIds, queues],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const names = selection.selectedIds;
    if (!names.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(names.map((name) => deleteQueue(name).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteQueue]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="queues"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <ListOrdered size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("queues.count", { count: queues.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="queues-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: queues,
            columns: columns,
            getRowId: (row) => row.name,
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "queues_export",
          }}
          selection={selection}
          onCopySelected={(item) =>
            dispatch(queuesPageActions.openCopyModal(item.name))
          }

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("queues.deleteSelected", {
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

  if (isMobile) {
    return (
      <Card
        className={[tableStyles.surface, cls.card].join(" ")}
        data-testid="hybrid-table"
        data-hybrid="mobile-card"
      >
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t("queues.noQueues")}
              </Text>
            ) : (
              filtered.map((row) => (
                <TableCard
                  onActivate={() =>
                    dispatch(queuesPageActions.openEditModal(row.name))
                  }
                  key={row.name}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="queues-mobile-card"
                  selection={selection.cardSelection(
                    String(row.name),
                    t("common.selectRowAria", { index: String(row.name) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.exten}>
                        {row.exten || row.name}
                      </Text>
                      <Text as="span" className={cls.name}>
                        {row.display_name || "-"}
                      </Text>
                      <Text as="span" className={cls.muted}>
                        {formatQueueStrategy(row.strategy, t)}
                        {" · "}
                        {row.memberCount || 0} {t("queues.members")}
                      </Text>
                    </VStack>
                  </HStack>
                </TableCard>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
      </Card>
    );
  }

  return (
    <Card
      className={[tableStyles.surface, cls.card].join(" ")}
      data-testid="hybrid-table"
      data-hybrid="overflow-x-auto"
    >
      <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="queues-table-scroll"
        >
          <Table
            onRowClick={(row) =>
              dispatch(queuesPageActions.openEditModal(row.name))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={queues}
            columns={columns}
            getRowId={(row) => row.name}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("queues.noQueues")}
            exportFilename="queues_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

QueuesTable.displayName = "QueuesTable";
