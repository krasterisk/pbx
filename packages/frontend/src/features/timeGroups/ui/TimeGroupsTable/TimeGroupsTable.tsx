import { TableCard } from "@/shared/ui";

import {
  useBulkDeleteTimeGroupsMutation,
  useGetTimeGroupsQuery,
} from "@/shared/api/endpoints/timeGroupApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Calendar, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeGroupsActions } from "../../model/slice/timeGroupsSlice";
import cls from "./TimeGroupsTable.module.scss";
import {
  formatTimeGroupInterval,
  useTimeGroupsTableColumns,
} from "./useTimeGroupsTableColumns";

const PAGE_SIZE = 50;

export const TimeGroupsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: timeGroups = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetTimeGroupsQuery();

  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteTimeGroupsMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useTimeGroupsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return timeGroups;
    return timeGroups.filter((tg) => {
      const name = (tg.name || "").toLowerCase();
      const comment = (tg.comment || "").toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [timeGroups, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = timeGroups.find((tg) => String(tg.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, timeGroups],
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
      i18nNs="timeGroups"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Calendar size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("timeGroups.count", { count: timeGroups.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="timegroups-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: timeGroups,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "timegroups_export",
          }}
          selection={selection}
          onCopySelected={(item) =>
            dispatch(timeGroupsActions.openCopyModal(item))
          }

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("timeGroups.deleteSelected", {
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
                {t("timeGroups.empty")}
              </Text>
            ) : (
              filtered.map((tg) => (
                <TableCard
                  onActivate={() =>
                    dispatch(timeGroupsActions.openEditModal(tg))
                  }
                  key={tg.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="timegroups-mobile-card"
                  selection={selection.cardSelection(
                    String(tg.uid),
                    t("common.selectRowAria", { index: String(tg.uid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {tg.name}
                      </Text>
                      {tg.comment ? (
                        <Text as="span" className={cls.comment}>
                          {tg.comment}
                        </Text>
                      ) : null}
                      {(tg.intervals || []).length === 0 ? (
                        <Text as="span" className={cls.noIntervals}>
                          {t("timeGroups.noIntervals")}
                        </Text>
                      ) : (
                        (tg.intervals || []).map((interval, i) => (
                          <Text as="span" key={i} className={cls.intervalChip}>
                            {formatTimeGroupInterval(interval, t)}
                          </Text>
                        ))
                      )}
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
          data-testid="timegroups-table-scroll"
        >
          <Table
            onRowClick={(tg) => dispatch(timeGroupsActions.openEditModal(tg))}
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={timeGroups}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("timeGroups.empty")}
            exportFilename="timegroups_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

TimeGroupsTable.displayName = "TimeGroupsTable";
