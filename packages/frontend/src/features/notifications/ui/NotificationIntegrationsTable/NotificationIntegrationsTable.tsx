import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Bell, Search, Loader2, Trash2, Pencil, Copy } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
  TableSelectionBanner,
  BulkDeleteDialog,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetNotificationsQuery,
  useDeleteNotificationMutation,
} from '@/shared/api/endpoints/notificationApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import {
  formatNotificationChannel,
  useNotificationIntegrationsTableColumns,
} from './useNotificationIntegrationsTableColumns';
import cls from './NotificationIntegrationsTable.module.scss';

const PAGE_SIZE = 50;

export const NotificationIntegrationsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: integrations = [], isLoading } = useGetNotificationsQuery();
  const [deleteIntegration] = useDeleteNotificationMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useNotificationIntegrationsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter((row) => {
      const name = (row.name || '').toLowerCase();
      const channel = (row.channel || '').toLowerCase();
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

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof integrations)[number]>) => (
      <TableSelectionBanner
        table={table}
        pageSize={PAGE_SIZE}
        allMatchingSelected={selection.allMatchingSelected}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        onSelectAllMatching={selection.selectAllMatching}
        onClear={selection.clearSelection}
      />
    ),
    [selection],
  );

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
          {t('notifications.count', { count: integrations.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={selection.openBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('notifications.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="notifications-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
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
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t('notifications.noIntegrations')}
              </Text>
            ) : (
              filtered.map((integration) => (
                <Flex
                  key={integration.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="notifications-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{integration.name}</Text>
                      <Text as="span" className={cls.muted}>
                        {formatNotificationChannel(integration.channel, t)}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(notificationsPageActions.openEditModal(integration.uid))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        title={t('common.copy')}
                        aria-label={t('common.copy')}
                        onClick={() => dispatch(notificationsPageActions.openCopyModal(integration.uid))}
                      >
                        <Copy />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('notifications.confirmDelete', { name: integration.name }))) {
                            deleteIntegration(integration.uid);
                          }
                        }}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="notifications-table-scroll"
        >
          <DataTable
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
            emptyText={t('notifications.noIntegrations')}
            exportFilename="notification_integrations_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

NotificationIntegrationsTable.displayName = 'NotificationIntegrationsTable';
