import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteIvrMutation } from '@/shared/api/endpoints/ivrsApi';
import { IIvr } from '@/entities/ivr';
import { ivrsActions } from '../../model/slice/ivrsSlice';
import cls from './IvrsTable.module.scss';

const columnHelper = createColumnHelper<IIvr>();

export const useIvrsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteIvr] = useDeleteIvrMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('ivrs.table.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('timeout', {
        header: () => t('ivrs.table.timeout'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() ?? '-'}</Text>
        ),
      }),

      columnHelper.accessor('max_count', {
        header: () => t('ivrs.table.maxCount'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue()}</Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const ivr = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(ivrsActions.openEditModal(ivr))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(ivrsActions.openCopyModal(ivr))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('ivrs.confirmDelete', { name: ivr.name }))) {
                    deleteIvr(ivr.uid);
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
    [t, dispatch, deleteIvr],
  );
};
