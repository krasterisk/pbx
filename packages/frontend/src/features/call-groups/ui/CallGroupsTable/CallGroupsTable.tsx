import { TableCard } from "@/shared/ui";

import {
  useDeleteCallGroupMutation,
  useGetCallGroupsQuery,
} from "@/shared/api/endpoints/callGroupApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, UsersRound } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { callGroupsPageActions } from "../../model/slice/callGroupsPageSlice";
import cls from "./CallGroupsTable.module.scss";
import {
  formatCallGroupStrategy,
  useCallGroupsTableColumns,
} from "./useCallGroupsTableColumns";

const PAGE_SIZE = 50;

export const CallGroupsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: callGroups = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetCallGroupsQuery();
  const [deleteCallGroup] = useDeleteCallGroupMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useCallGroupsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return callGroups;
    return callGroups.filter((row) => {
      const name = (row.name || "").toLowerCase();
      const strategy = (row.strategy || "").toLowerCase();
      const exten = (row.exten || "").toLowerCase();
      return name.includes(q) || strategy.includes(q) || exten.includes(q);
    });
  }, [callGroups, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = callGroups.find((group) => String(group.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, callGroups],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteCallGroup(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteCallGroup]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="callGroups"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <UsersRound size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("callGroups.count", { count: callGroups.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="call-groups-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: callGroups,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "call_groups_export",
          }}
          selection={selection}
          onCopySelected={(item) =>
            dispatch(callGroupsPageActions.openCopyModal(item.uid))
          }

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("callGroups.deleteSelected", {
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
                {t("callGroups.noGroups")}
              </Text>
            ) : (
              filtered.map((group) => {
                const memberCount = group.members?.length ?? 0;
                return (
                  <TableCard
                    onActivate={() =>
                      dispatch(callGroupsPageActions.openEditModal(group.uid))
                    }
                    key={group.uid}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid="call-groups-mobile-card"
                    selection={selection.cardSelection(
                      String(group.uid),
                      t("common.selectRowAria", { index: String(group.uid) }),
                    )}
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text as="span" className={cls.name}>
                          {group.name}
                        </Text>
                        <Text as="span" className={cls.muted}>
                          {formatCallGroupStrategy(group.strategy, t)}
                          {" · "}
                          {memberCount} {t("callGroups.members")}
                        </Text>
                      </VStack>
                    </HStack>
                  </TableCard>
                );
              })
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
          data-testid="call-groups-table-scroll"
        >
          <Table
            onRowClick={(group) =>
              dispatch(callGroupsPageActions.openEditModal(group.uid))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={callGroups}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("callGroups.noGroups")}
            exportFilename="call_groups_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

CallGroupsTable.displayName = "CallGroupsTable";
