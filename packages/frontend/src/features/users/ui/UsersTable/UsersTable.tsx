import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Search, Loader2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { useGetUsersQuery, useGetRolesQuery, useBulkDeleteUsersMutation } from '@/shared/api/api';
import type { IUser } from '@/entities/User';
import { useUsersTableColumns } from './useUsersTableColumns';

export const UsersTable = memo(() => {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteUsersMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const rolesMap = useMemo(() => {
    const map: Record<number, string> = {};
    roles.forEach((r) => { map[r.id] = r.name; });
    return map;
  }, [roles]);

  const columns = useUsersTableColumns({ rolesMap });

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
              {t('users.count', { count: users.length })}
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
                id="users-search"
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
            data={users as IUser[]}
            columns={columns}
            getRowId={(row) => String(row.uniqueid)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="users_export"
          />
        )}
      </CardContent>
    </Card>
  );
});

UsersTable.displayName = 'UsersTable';

