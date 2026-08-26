import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import type { IUser } from '@/entities/User';
import { UserLevelBadge } from '@/entities/User';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { useDeleteUserMutation } from '@/shared/api/api';
import { TableRowActions, TableRowAction } from '@/shared/ui';

interface UseUsersTableColumnsProps {
  rolesMap: Record<number, string>;
  numbersMap: Record<number, string>;
}

export const useUsersTableColumns = ({ rolesMap, numbersMap }: UseUsersTableColumnsProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteUser] = useDeleteUserMutation();

  return useMemo<ColumnDef<IUser>[]>(() => [
    {
      accessorKey: 'name',
      header: t('users.name'),
    },
    {
      accessorKey: 'exten',
      header: t('users.exten'),
      cell: (info) => (
        <span className="text-primary font-mono">{(info.getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: t('users.email'),
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      accessorKey: 'level',
      header: t('users.level'),
      cell: (info) => <UserLevelBadge level={info.getValue() as number} />,
    },
    {
      accessorKey: 'role',
      header: t('users.role'),
      cell: (info) => {
        const roleId = info.getValue() as number;
        return rolesMap[roleId] || '-';
      },
    },
    {
      accessorKey: 'numbers_id',
      header: t('users.numbersId'),
      cell: (info) => {
        const id = info.getValue() as number | undefined;
        if (!id) return '-';
        return numbersMap[id] || String(id);
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
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
    },
  ], [t, rolesMap, numbersMap, dispatch, deleteUser]);
};
