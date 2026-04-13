import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Shield, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, DataTable, Button } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { useGetRolesQuery, useDeleteRoleMutation, useBulkDeleteRolesMutation } from '@/shared/api/api';
import { bulkDeleteRoles } from '../../model/services/rolesBulkActions';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { rolesPageActions } from '../../model/slice/rolesPageSlice';

export const RolesTable = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  const { data: roles = [], isLoading } = useGetRolesQuery();
  const [deleteRole] = useDeleteRoleMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRolesMutation();
  
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Название интерфейса',
      cell: (info) => <span className="font-medium text-white">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'comment',
      header: 'Комментарий',
      cell: (info) => (info.getValue() as string) || '—',
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => (
        <HStack gap="8" justify="end">
          <button
            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
            title={t('common.edit')}
            onClick={() => dispatch(rolesPageActions.openEditModal(info.row.original))}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title={t('common.delete')}
            onClick={() => {
              if (window.confirm(t('common.confirmDelete', `Удалить роль ${info.row.original.name}?`))) {
                deleteRole(info.row.original.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </HStack>
      ),
    },
  ], [t, deleteRole, dispatch]);

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {roles.length} {(t('nav.roles' as any) || 'Интерфейсы').toLowerCase()}
            </span>
          </HStack>
          <HStack gap="12" align="center" className="w-full sm:w-auto">
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={handleBulkDelete}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
              </Button>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </HStack>
        </HStack>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        ) : (
          <DataTable
            data={roles}
            columns={columns}
            getRowId={(row) => String(row.id)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="roles_export"
          />
        )}
      </CardContent>
    </Card>
  );
};
