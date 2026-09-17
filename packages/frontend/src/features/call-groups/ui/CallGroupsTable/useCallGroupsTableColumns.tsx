import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteCallGroupMutation } from '@/shared/api/endpoints/callGroupApi';
import type { ICallGroup } from '@krasterisk/shared';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import cls from './CallGroupsTable.module.scss';

const columnHelper = createColumnHelper<ICallGroup>();

const STRATEGY_KEYS = ['ringall', 'hunt', 'memoryhunt', 'random'] as const;

export function formatCallGroupStrategy(strategy: string | undefined, t: TFunction): string {
  if (!strategy) return '-';
  if (STRATEGY_KEYS.includes(strategy as typeof STRATEGY_KEYS[number])) {
    return t(`callGroups.strategy.${strategy}`);
  }
  return strategy;
}

export const useCallGroupsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteCallGroup] = useDeleteCallGroupMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('callGroups.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('strategy', {
        header: () => t('callGroups.strategy'),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {formatCallGroupStrategy(info.getValue(), t)}
          </Text>
        ),
      }),

      columnHelper.accessor((row) => row.members?.length ?? 0, {
        id: 'memberCount',
        header: () => t('callGroups.members'),
        cell: (info) => {
          const count = info.getValue();
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

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const group = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(callGroupsPageActions.openEditModal(group.uid))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(callGroupsPageActions.openCopyModal(group.uid))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('callGroups.confirmDelete', { name: group.name }))) {
                    deleteCallGroup(group.uid);
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
    [t, dispatch, deleteCallGroup],
  );
};
