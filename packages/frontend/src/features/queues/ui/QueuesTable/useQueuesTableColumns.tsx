import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteQueueMutation } from '@/shared/api/endpoints/queueApi';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import type { IQueue } from '../../model/types/queuesSchema';
import cls from './QueuesTable.module.scss';

const columnHelper = createColumnHelper<IQueue>();

export function formatQueueStrategy(strategy: string | undefined, t: TFunction): string {
  if (!strategy) return '-';
  const key = `queues.strategy.${strategy}`;
  const label = t(key);
  return label === key ? strategy : label;
}

export const useQueuesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteQueue] = useDeleteQueueMutation();

  return useMemo(
    () => [
      columnHelper.accessor((row) => row.exten || row.name, {
        id: 'exten',
        header: () => t('queues.exten'),
        cell: (info) => (
          <Text as="span" className={cls.exten}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.accessor('display_name', {
        header: () => t('queues.displayName'),
        cell: (info) => (
          <Text as="span" className={cls.name}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.accessor('strategy', {
        header: () => t('queues.strategy'),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {formatQueueStrategy(info.getValue(), t)}
          </Text>
        ),
      }),

      columnHelper.accessor('memberCount', {
        header: () => t('queues.members'),
        cell: (info) => {
          const count = info.getValue() || 0;
          return (
            <Text
              as="span"
              className={count > 0 ? cls.memberBadgeActive : cls.memberBadgeMuted}
            >
              {count}
            </Text>
          );
        },
      }),

      columnHelper.accessor('timeout', {
        header: () => t('queues.timeout'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() ?? '-'}s</Text>
        ),
      }),

      columnHelper.accessor('maxlen', {
        header: () => t('queues.maxlen'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() || '∞'}</Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const queue = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(queuesPageActions.openEditModal(queue.name))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(queuesPageActions.openCopyModal(queue.name))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('queues.confirmDelete', { name: queue.name }))) {
                    deleteQueue(queue.name);
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
    [t, dispatch, deleteQueue],
  );
};
