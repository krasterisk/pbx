import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import type { IUser } from '@/entities/User';
import { UserLevelBadge } from '@/entities/User';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { useDeleteUserMutation } from '@/shared/api/api';
import cls from './UsersTable.module.scss';

const columnHelper = createColumnHelper<IUser>();

interface UseUsersTableColumnsProps {
  rolesMap: Record<number, string>;
  numbersMap: Record<number, string>;
}

export const useUsersTableColumns = ({ rolesMap, numbersMap }: UseUsersTableColumnsProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteUser] = useDeleteUserMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('users.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('exten', {
        header: () => t('users.exten'),
        cell: (info) => (
          <Text as="span" className={cls.exten}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.accessor('email', {
        header: () => t('users.email'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{info.getValue() || '-'}</Text>
        ),
      }),

      columnHelper.accessor('level', {
        header: () => t('users.level'),
        cell: (info) => <UserLevelBadge level={info.getValue()} />,
      }),

      columnHelper.accessor('role', {
        header: () => t('users.role'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>{rolesMap[info.getValue()] || '-'}</Text>
        ),
      }),

      columnHelper.accessor('numbers_id', {
        header: () => t('users.numbersId'),
        cell: (info) => {
          const id = info.getValue();
          if (!id) {
            return <Text as="span" className={cls.muted}>-</Text>;
          }
          return (
            <Text as="span" className={cls.muted}>{numbersMap[id] || String(id)}</Text>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const user = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(usersPageActions.openEditModal(user))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('users.confirmDelete', { login: user.login }))) {
                    deleteUser(user.uniqueid);
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
    [t, rolesMap, numbersMap, dispatch, deleteUser],
  );
};
