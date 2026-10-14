import { TableCard } from "@/shared/ui";

import { useBulkDeleteRolesMutation, useGetRolesQuery } from "@/shared/api/api";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Shield } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { rolesPageActions } from "../../model/slice/rolesPageSlice";
import cls from "./RolesTable.module.scss";
import { useRolesTableColumns } from "./useRolesTableColumns";

const PAGE_SIZE = 50;

export const RolesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: roles = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetRolesQuery();

  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRolesMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useRolesTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) => {
      const name = (role.name || "").toLowerCase();
      const comment = (role.comment || role.description || "").toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [roles, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = roles.find((r) => String(r.id) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, roles],
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
      i18nNs="roles"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Shield size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("roles.count", { count: roles.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="roles-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: roles,
            columns: columns,
            getRowId: (row) => String(row.id),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "roles_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("roles.deleteSelected", {
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
                {t("roles.empty")}
              </Text>
            ) : (
              filtered.map((role) => (
                <TableCard
                  onActivate={() =>
                    dispatch(rolesPageActions.openEditModal(role))
                  }
                  key={role.id}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="roles-mobile-card"
                  selection={selection.cardSelection(
                    String(role.id),
                    t("common.selectRowAria", { index: String(role.id) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {role.name}
                      </Text>
                      <Text as="span" className={cls.comment}>
                        {role.comment || role.description || "-"}
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
          data-testid="roles-table-scroll"
        >
          <Table
            onRowClick={(role) =>
              dispatch(rolesPageActions.openEditModal(role))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={roles}
            columns={columns}
            getRowId={(row) => String(row.id)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("roles.empty")}
            exportFilename="roles_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

RolesTable.displayName = "RolesTable";
