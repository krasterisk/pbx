import { TableCard } from "@/shared/ui";

import { useBulkDeleteNumbersMutation,useGetNumbersQuery } from "@/shared/api/api";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex,HStack,VStack } from "@/shared/ui/Stack";

import { Hash,Loader2 } from "lucide-react";
import { memo,useCallback,useMemo,useState } from "react";
import { useTranslation } from "react-i18next";
import { numbersPageActions } from "../../model/slice/numbersPageSlice";
import cls from "./NumbersTable.module.scss";
import { useNumbersTableColumns } from "./useNumbersTableColumns";

const PAGE_SIZE = 50;

export const NumbersTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: numbers = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetNumbersQuery();

  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteNumbersMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useNumbersTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter((n) => {
      const name = (n.name || "").toLowerCase();
      const comment = (n.comment || n.description || "").toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [numbers, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = numbers.find((n) => String(n.id) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, numbers],
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
      i18nNs="numbers"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Hash size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("numbers.count", { count: numbers.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar

          tableRef={selection.tableRef}
          searchId="numbers-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: numbers,
            columns: columns,
            getRowId: (row) => String(row.id),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "numbers_export",
          }}
          selection={selection}  onDeleteSelected={selection.openBulkDelete} deleteDisabled={isDeleting} deleteLabel={t("numbers.deleteSelected", {
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
                {t("numbers.empty")}
              </Text>
            ) : (
              filtered.map((row) => (
                <TableCard
                  onActivate={() =>
                    dispatch(numbersPageActions.openEditModal(row))
                  }

                  key={row.id}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="numbers-mobile-card" selection={selection.cardSelection(String(row.id), t("common.selectRowAria", { index: String(row.id) }))}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {row.name}
                      </Text>
                      <Text as="span" className={cls.comment}>
                        {row.comment || row.description || "-"}
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
          data-testid="numbers-table-scroll"
        >
          <Table
            onRowClick={(row) =>
              dispatch(numbersPageActions.openEditModal(row))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={numbers}
            columns={columns}
            getRowId={(row) => String(row.id)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("numbers.empty")}
            exportFilename="numbers_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

NumbersTable.displayName = "NumbersTable";
