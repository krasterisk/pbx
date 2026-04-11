import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import type { IUser } from '@/entities/User';
import { UserLevelBadge } from '@/entities/User';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { useDeleteUserMutation } from '@/shared/api/api';
import { HStack } from '@/shared/ui/Stack';
import type { IRole } from '@/shared/api/api';

interface UseUsersTableColumnsProps {
  rolesMap: Record<number, string>;
}

export const useUsersTableColumns = ({ rolesMap }: UseUsersTableColumnsProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteUser] = useDeleteUserMutation();

  return useMemo<ColumnDef<IUser>[]>(() => [
    {
      accessorKey: 'login',
      header: t('auth.loginPlaceholder'),
      cell: (info) => (
        <span className="font-medium text-white">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('peers.name'),
    },
    {
      accessorKey: 'exten',
      header: t('peers.exten'),
      cell: (info) => (
        <span className="text-primary font-mono">{(info.getValue() as string) || '—'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info) => (info.getValue() as string) || '—',
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
        return rolesMap[roleId] || '—';
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => (
        <HStack gap="4">
          <button
            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
            title={t('common.edit')}
            onClick={() => dispatch(usersPageActions.openEditModal(info.row.original))}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title={t('common.delete')}
            onClick={() => {
              if (confirm(t('users.confirmDelete', { login: info.row.original.login }))) {
                deleteUser(info.row.original.uniqueid);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </HStack>
      ),
    },
  ], [t, rolesMap, dispatch, deleteUser]);
};
