import { useDeleteNotificationMutation } from '@/shared/api/endpoints/notificationApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { Text } from '@/shared/ui';
import type { INotificationIntegration } from '@krasterisk/shared';
import { createColumnHelper } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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


    ],
    [t, dispatch, deleteIntegration],
  );
};
