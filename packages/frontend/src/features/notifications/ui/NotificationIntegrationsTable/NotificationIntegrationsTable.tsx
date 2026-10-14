import { TableCard } from "@/shared/ui";

import {
useDeleteNotificationMutation,
useGetNotificationsQuery,
} from "@/shared/api/endpoints/notificationApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex,HStack,VStack } from "@/shared/ui/Stack";

import { Bell,Loader2 } from "lucide-react";
import { memo,useCallback,useMemo,useState } from "react";
import { useTranslation } from "react-i18next";
import { notificationsPageActions } from "../../model/slice/notificationsPageSlice";
import cls from "./NotificationIntegrationsTable.module.scss";
import {
formatNotificationChannel,
useNotificationIntegrationsTableColumns,
} from "./useNotificationIntegrationsTableColumns";

const PAGE_SIZE = 50;

export const NotificationIntegrationsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: integrations = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetNotificationsQuery();
  const [deleteIntegration] = useDeleteNotificationMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useNotificationIntegrationsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter((row) => {
      const name = (row.name || "").toLowerCase();
      const channel = (row.channel || "").toLowerCase();
      return name.includes(q) || channel.includes(q);
    });
  }, [integrations, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = integrations.find((item) => String(item.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, integrations],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteIntegration(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteIntegration]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="notifications"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Bell size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("notifications.count", { count: integrations.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar

          tableRef={selection.tableRef}
          searchId="notifications-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: integrations,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "notification_integrations_export",
          }}
          selection={selection} onCopySelected={(item) => dispatch(
                            notificationsPageActions.openCopyModal(
                              item.uid,
                            ),
                          )}  onDeleteSelected={selection.openBulkDelete} deleteDisabled={isDeleting} deleteLabel={t("notifications.deleteSelected", {
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
                {t("notifications.noIntegrations")}
              </Text>
            ) : (
              filtered.map((integration) => (
                <TableCard
                  onActivate={() =>
                    dispatch(
                      notificationsPageActions.openEditModal(integration.uid),
                    )
                  }

                  key={integration.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="notifications-mobile-card" selection={selection.cardSelection(String(integration.uid), t("common.selectRowAria", { index: String(integration.uid) }))}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {integration.name}
                      </Text>
                      <Text as="span" className={cls.muted}>
                        {formatNotificationChannel(integration.channel, t)}
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
          data-testid="notifications-table-scroll"
        >
          <Table
            onRowClick={(integration) =>
              dispatch(notificationsPageActions.openEditModal(integration.uid))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={integrations}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("notifications.noIntegrations")}
            exportFilename="notification_integrations_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

NotificationIntegrationsTable.displayName = "NotificationIntegrationsTable";
