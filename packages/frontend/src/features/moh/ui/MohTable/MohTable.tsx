import { TableCard } from "@/shared/ui";

import {
useDeleteMohClassMutation,
useGetMohClassesQuery,
} from "@/shared/api/endpoints/mohApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex,HStack,VStack } from "@/shared/ui/Stack";

import { Loader2,Music } from "lucide-react";
import { memo,useCallback,useMemo,useState } from "react";
import { useTranslation } from "react-i18next";
import { mohActions } from "../../model/slice/mohSlice";
import cls from "./MohTable.module.scss";
import { useMohTableColumns } from "./useMohTableColumns";

const PAGE_SIZE = 50;

export const MohTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: mohClasses = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetMohClassesQuery();
  const [deleteMoh] = useDeleteMohClassMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);
  const columns = useMohTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return mohClasses;
    return mohClasses.filter((moh) => {
      const name = (moh.displayName || "").toLowerCase();
      const sort = (moh.sort || "").toLowerCase();
      return name.includes(q) || sort.includes(q);
    });
  }, [mohClasses, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = mohClasses.find((moh) => moh.name === id);
        return row?.displayName || id;
      }),
    [selection.selectedIds, mohClasses],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const names = selection.selectedIds;
    if (!names.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(names.map((name) => deleteMoh(name).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteMoh]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="moh"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Music size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("moh.count", { count: mohClasses.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar

          tableRef={selection.tableRef}
          searchId="moh-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: mohClasses,
            columns: columns,
            getRowId: (row) => row.name,
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "moh_export",
          }}
          selection={selection}  onDeleteSelected={selection.openBulkDelete} deleteDisabled={isDeleting} deleteLabel={t("moh.deleteSelected", {
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
                {t("moh.empty.title")}
              </Text>
            ) : (
              filtered.map((moh) => (
                <TableCard
                  onActivate={() => dispatch(mohActions.openEditModal(moh))}

                  key={moh.name}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="moh-mobile-card" selection={selection.cardSelection(String(moh.name), t("common.selectRowAria", { index: String(moh.name) }))}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <HStack gap="8" align="center">
                        <Music size={16} className={cls.musicIcon} />
                        <Text as="span" className={cls.name}>
                          {moh.displayName}
                        </Text>
                      </HStack>
                      <Text as="span" className={cls.tracksBadge}>
                        {moh.entries?.length || 0}
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
          data-testid="moh-table-scroll"
        >
          <Table
            onRowClick={(moh) => dispatch(mohActions.openEditModal(moh))}
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={mohClasses}
            columns={columns}
            getRowId={(row) => row.name}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("moh.empty.title")}
            exportFilename="moh_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

MohTable.displayName = "MohTable";
