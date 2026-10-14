import { TableCard } from "@/shared/ui";

import type { IUser } from "@/entities/User";
import { UserLevelBadge } from "@/entities/User";
import {
  useBulkDeleteUsersMutation,
  useGetNumbersQuery,
  useGetRolesQuery,
  useGetUsersQuery,
} from "@/shared/api/api";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Shield } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { usersPageActions } from "../../model/slice/usersPageSlice";
import cls from "./UsersTable.module.scss";
import { useUsersTableColumns } from "./useUsersTableColumns";

const PAGE_SIZE = 50;

export const UsersTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: users = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const { data: numbers = [] } = useGetNumbersQuery();

  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteUsersMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const rolesMap = useMemo(() => {
    const map: Record<number, string> = {};
    roles.forEach((r) => {
      map[r.id] = r.name;
    });
    return map;
  }, [roles]);

  const numbersMap = useMemo(() => {
    const map: Record<number, string> = {};
    numbers.forEach((n) => {
      map[n.id] = n.name;
    });
    return map;
  }, [numbers]);

  const columns = useUsersTableColumns({ rolesMap, numbersMap });

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return users as IUser[];
    return (users as IUser[]).filter((user) => {
      const name = (user.name || "").toLowerCase();
      const login = (user.login || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const exten = (user.exten || "").toLowerCase();
      return (
        name.includes(q) ||
        login.includes(q) ||
        email.includes(q) ||
        exten.includes(q)
      );
    });
  }, [users, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = (users as IUser[]).find((u) => String(u.uniqueid) === id);
        return row?.login || row?.name || id;
      }),
    [selection.selectedIds, users],
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
      i18nNs="users"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Shield size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("users.count", { count: users.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="users-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: users as IUser[],
            columns: columns,
            getRowId: (row) => String(row.uniqueid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "users_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("users.deleteSelected", {
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
                {t("users.empty")}
              </Text>
            ) : (
              filtered.map((user) => (
                <TableCard
                  onActivate={() =>
                    dispatch(usersPageActions.openEditModal(user))
                  }
                  key={user.uniqueid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="users-mobile-card"
                  selection={selection.cardSelection(
                    String(user.uniqueid),
                    t("common.selectRowAria", { index: String(user.uniqueid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {user.name}
                      </Text>
                      <Text as="span" className={cls.exten}>
                        {user.exten || "-"}
                      </Text>
                      <Text as="span" className={cls.muted}>
                        {user.email || "-"}
                      </Text>
                      <UserLevelBadge level={user.level} />
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
          data-testid="users-table-scroll"
        >
          <Table
            onRowClick={(user) =>
              dispatch(usersPageActions.openEditModal(user))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={users as IUser[]}
            columns={columns}
            getRowId={(row) => String(row.uniqueid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("users.empty")}
            exportFilename="users_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

UsersTable.displayName = "UsersTable";
