import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { contextsActions } from '../../model/slice/contextsSlice';
import { useDeleteContextMutation, IContext } from '@/shared/api/api';
import cls from './ContextsTable.module.scss';

const columnHelper = createColumnHelper<IContext>();

export const useContextsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteContext] = useDeleteContextMutation();

  return useMemo(
    () => [
      columnHelper.accessor('uid', {
        header: 'ID',
        cell: (info) => <Text className={cls.uid}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('name', {
        header: t('contexts.name', 'Имя'),
        cell: (info) => <Text className={cls.name}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('comment', {
        header: t('contexts.description', 'Описание'),
        cell: (info) => <Text variant="muted">{info.getValue() || '-'}</Text>,
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
                onClick={() => dispatch(contextsActions.openEditModal(row))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
                    deleteContext(row.uid);
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
    [t, dispatch, deleteContext],
  );
};
