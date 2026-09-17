import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteRoleMutation, type IRole } from '@/shared/api/api';
import { rolesPageActions } from '../../model/slice/rolesPageSlice';
import cls from './RolesTable.module.scss';

const columnHelper = createColumnHelper<IRole>();

export const useRolesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteRole] = useDeleteRoleMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('roles.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('comment', {
        header: () => t('roles.comment'),
        cell: (info) => (
          <Text as="span" className={cls.comment}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const role = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(rolesPageActions.openEditModal(role))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('roles.confirmDelete', { name: role.name }))) {
                    void deleteRole(role.id);
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
    [t, dispatch, deleteRole],
  );
};
