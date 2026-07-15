import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import type { INotificationIntegration } from '@krasterisk/shared';
import { DataTable, HStack, Button } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  useGetNotificationsQuery,
  useDeleteNotificationMutation,
} from '@/shared/api/endpoints/notificationApi';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';

export const NotificationIntegrationsTable = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: integrations = [] } = useGetNotificationsQuery();
  const [deleteIntegration] = useDeleteNotificationMutation();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleEdit = useCallback(
    (uid: number) => {
      dispatch(notificationsPageActions.openEditModal(uid));
    },
    [dispatch],
  );

  const handleCopy = useCallback(
    (uid: number) => {
      dispatch(notificationsPageActions.openCopyModal(uid));
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    async (integration: INotificationIntegration) => {
      if (
        !window.confirm(
          t('notifications.confirmDelete', {
            name: integration.name,
            defaultValue: `Delete integration "${integration.name}"?`,
          }),
        )
      ) {
        return;
      }
      await deleteIntegration(integration.uid);
    },
    [deleteIntegration, t],
  );

  const columns: ColumnDef<INotificationIntegration>[] = [
    {
      accessorKey: 'name',
      header: t('notifications.name', 'Name'),
      size: 220,
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'channel',
      header: t('notifications.channel', 'Channel'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-sm">
          {t(`notifications.channels.${row.original.channel}`, row.original.channel)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <HStack gap="4" align="center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original.uid)}
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original.uid)}
            title={t('common.copy')}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original)}
            title={t('common.delete')}
            className="hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={integrations}
      getRowId={(row) => String(row.uid)}
      selectable={false}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      emptyText={t('notifications.noIntegrations', 'No integrations')}
      exportFilename="notification_integrations_export"
    />
  );
};
