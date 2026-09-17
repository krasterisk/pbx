import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteNumberMutation, type INumberList } from '@/shared/api/api';
import { numbersPageActions } from '../../model/slice/numbersPageSlice';
import cls from './NumbersTable.module.scss';

const columnHelper = createColumnHelper<INumberList>();

export const useNumbersTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteNumber] = useDeleteNumberMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('numbers.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('comment', {
        header: () => t('numbers.comment'),
        cell: (info) => (
          <Text as="span" className={cls.comment}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(numbersPageActions.openEditModal(row))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('numbers.confirmDelete', { name: row.name }))) {
                    void deleteNumber(row.id);
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
    [t, dispatch, deleteNumber],
  );
};
