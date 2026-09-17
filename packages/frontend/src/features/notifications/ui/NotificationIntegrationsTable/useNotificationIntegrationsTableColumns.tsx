import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import type { INotificationIntegration } from '@krasterisk/shared';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteNotificationMutation } from '@/shared/api/endpoints/notificationApi';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import cls from './NotificationIntegrationsTable.module.scss';

const columnHelper = createColumnHelper<INotificationIntegration>();

export function formatNotificationChannel(
  channel: INotificationIntegration['channel'],
  t: TFunction,
): string {
  return t(`notifications.channels.${channel}`, channel);
}

export const useNotificationIntegrationsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteIntegration] = useDeleteNotificationMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('notifications.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('channel', {
        header: () => t('notifications.channel'),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {formatNotificationChannel(info.getValue(), t)}
          </Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const integration = info.row.original;
          return (
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
          );
        },
      }),
    ],
    [t, dispatch, deleteIntegration],
  );
};
