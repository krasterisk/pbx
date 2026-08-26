import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Shield, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  DataTable,
  Button,
  Text,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import { useGetRolesQuery, useDeleteRoleMutation, useBulkDeleteRolesMutation } from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { rolesPageActions } from '../../model/slice/rolesPageSlice';
import styles from './RolesTable.module.scss';

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
      header: t('roles.name'),
      cell: (info) => (
        <Text className={styles.nameCell}>{info.getValue() as string}</Text>
      ),
    },
    {
      accessorKey: 'comment',
      header: t('roles.comment'),
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      id: 'actions',
      header: t('common.actions'),
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
                if (window.confirm(t('common.confirmDelete', `Удалить роль ${role.name}?`))) {
                  void deleteRole(role.id);
                }
              }}
            >
              <Trash2 />
            </TableRowAction>
          </TableRowActions>
        );
      },
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
        <HStack justify="between" align="center" className={styles.toolbar} max>
          <HStack gap="8" align="center">
            <Shield className={styles.toolbarIcon} />
            <Text className={styles.toolbarTitle}>
              {roles.length} {t('nav.roles').toLowerCase()}
            </Text>
          </HStack>
          <HStack gap="12" align="center" className={styles.toolbarActions}>
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void handleBulkDelete()}
              >
                {isDeleting ? (
                  <Loader2 className={styles.iconSpin} />
                ) : (
                  <Trash2 className={styles.actionIcon} />
                )}
                {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
              </Button>
            )}
            <VStack className={styles.searchWrap}>
              <Search className={styles.searchIcon} />
              <Input
                placeholder={t('common.search')}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className={styles.searchInput}
              />
            </VStack>
          </HStack>
        </HStack>
      </CardHeader>
      <CardContent className={styles.tableContent}>
        {isLoading ? (
          <Flex align="center" justify="center" className={styles.loading}>
            <Loader2 className={styles.loadingIcon} />
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
