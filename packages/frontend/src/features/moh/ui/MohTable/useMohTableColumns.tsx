import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Music, Pencil, Trash2 } from 'lucide-react';
import { HStack } from '@/shared/ui/Stack';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { mohActions } from '../../model/slice/mohSlice';
import type { IMohClass } from '@/entities/moh';
import cls from './MohTable.module.scss';

const columnHelper = createColumnHelper<IMohClass>();

export const useMohTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteMoh] = useDeleteMohClassMutation();

  return useMemo(
    () => [
      columnHelper.display({
        id: 'index',
        header: () => t('moh.table.index'),
        size: 50,
        cell: (info) => (
          <Text as="span" className={cls.cell}>{info.row.index + 1}</Text>
        ),
      }),

      columnHelper.accessor('displayName', {
        header: () => t('moh.table.name'),
        cell: (info) => (
          <HStack gap="8" align="center">
            <Music size={16} className={cls.musicIcon} />
            <Text as="span" className={cls.name}>{info.getValue()}</Text>
          </HStack>
        ),
      }),

      columnHelper.accessor((row) => row.entries?.length || 0, {
        id: 'tracks',
        header: () => t('moh.table.tracks'),
        size: 100,
        cell: (info) => (
          <Text as="span" className={cls.tracksBadge}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.accessor('sort', {
        header: () => t('moh.table.sort'),
        size: 140,
        cell: (info) => {
          const val = info.getValue();
          const sortClass = val === 'random' ? cls.sortRandom : val === 'alpha' ? cls.sortAlpha : '';
          const label = val === 'random'
            ? t('moh.sort.random')
            : val === 'alpha'
              ? t('moh.sort.alpha')
              : val;
          return (
            <Text as="span" className={`${cls.sortBadge} ${sortClass}`}>{label}</Text>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const moh = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(mohActions.openEditModal(moh))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  const confirmed = window.confirm(
                    t('moh.confirmDelete').replace('{{name}}', moh.displayName),
                  );
                  if (confirmed) {
                    deleteMoh(moh.name);
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
    [t, dispatch, deleteMoh],
  );
};
