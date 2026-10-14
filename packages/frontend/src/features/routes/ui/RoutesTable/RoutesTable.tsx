import { TableCard, TableCardDetails } from "@/shared/ui";

import { useGetContextsQuery } from "@/shared/api/endpoints/contextApi";
import {
  useBulkDeleteRoutesMutation,
  useGetAllRoutesQuery,
} from "@/shared/api/endpoints/routeApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Route } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { routesActions } from "../../model/slice/routesSlice";
import cls from "./RoutesTable.module.scss";
import { RouteDialplanCount } from "./RouteDialplanCount";
import { useRoutesTableColumns } from "./useRoutesTableColumns";

const PAGE_SIZE = 50;

export const RoutesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const selectedContextUids = useAppSelector(
    (s) => s.routes.selectedContextUids,
  );

  const {
    data: allRoutes = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetAllRoutesQuery();
  const { data: contexts = [] } = useGetContextsQuery();

  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRoutesMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const contextMap = useMemo(() => {
    const map: Record<number, string> = {};
    contexts.forEach((c) => {
      map[c.uid] = c.name;
    });
    return map;
  }, [contexts]);

  const filteredRoutes = useMemo(() => {
    if (selectedContextUids.length === 0) return allRoutes;
    return allRoutes.filter((r) => selectedContextUids.includes(r.context_uid));
  }, [allRoutes, selectedContextUids]);

  const columns = useRoutesTableColumns(contextMap);

  const searchFiltered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return filteredRoutes;
    return filteredRoutes.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const ctx = (
        contextMap[r.context_uid] || String(r.context_uid)
      ).toLowerCase();
      const ext = (r.extensions || []).join(" ").toLowerCase();
      return name.includes(q) || ctx.includes(q) || ext.includes(q);
    });
  }, [filteredRoutes, globalFilter, contextMap]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = allRoutes.find((r) => String(r.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, allRoutes],
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
      i18nNs="routes"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Route size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("routes.count", { count: filteredRoutes.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="routes-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: filteredRoutes,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "routes_export",
          }}
          selection={selection}
          onCopySelected={(item) => dispatch(routesActions.openCopyModal(item))}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("routes.deleteSelected", {
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
            {searchFiltered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t("routes.noRoutes")}
              </Text>
            ) : (
              searchFiltered.map((route) => {
                const isActive = !!route.active;
                return (
                  <TableCard
                    onActivate={() =>
                      dispatch(routesActions.openEditModal(route))
                    }
                    key={route.uid}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid="routes-mobile-card"
                    selection={selection.cardSelection(
                      String(route.uid),
                      t("common.selectRowAria", { index: String(route.uid) }),
                    )}
                  >
                    <HStack justify="between" align="start" gap="8" max>
                      <VStack gap="4" className={cls.mobileTitle}>
                        <HStack gap="8" align="center">
                          <Flex
                            className={
                              isActive
                                ? cls.statusDotActive
                                : cls.statusDotInactive
                            }
                            title={
                              isActive
                                ? t("common.active")
                                : t("common.inactive")
                            }
                            aria-label={
                              isActive
                                ? t("common.active")
                                : t("common.inactive")
                            }
                          >
                            {""}
                          </Flex>
                          <Text as="span" className={cls.name}>
                            {route.name}
                          </Text>
                        </HStack>
                      </VStack>
                      <RouteDialplanCount
                        actions={route.actions ?? []}
                        showIcon
                      />
                    </HStack>
                    <TableCardDetails
                      fields={[
                        {
                          id: "context",
                          label: t("routes.context"),
                          value:
                            contextMap[route.context_uid] ||
                            String(route.context_uid),
                        },
                        {
                          id: "extensions",
                          label: t("routes.extensions"),
                          value: (
                            <HStack
                              gap="4"
                              className={cls.extChips}
                              wrap="wrap"
                            >
                              {(route.extensions || []).map((ext) => (
                                <Text
                                  key={ext}
                                  as="span"
                                  className={cls.extChip}
                                >
                                  {ext}
                                </Text>
                              ))}
                            </HStack>
                          ),
                        },
                      ]}
                    />
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
          data-testid="routes-table-scroll"
        >
          <Table
            onRowClick={(route) => dispatch(routesActions.openEditModal(route))}
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={filteredRoutes}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("routes.noRoutes")}
            exportFilename="routes_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

RoutesTable.displayName = "RoutesTable";
