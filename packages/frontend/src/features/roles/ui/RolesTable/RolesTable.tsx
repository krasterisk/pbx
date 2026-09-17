import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Search, Loader2, Trash2, Pencil } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useGetRolesQuery, useDeleteRoleMutation, useBulkDeleteRolesMutation } from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { rolesPageActions } from '../../model/slice/rolesPageSlice';
import { useRolesTableColumns } from './useRolesTableColumns';
import cls from './RolesTable.module.scss';

export const RolesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: roles = [], isLoading } = useGetRolesQuery();
  const [deleteRole] = useDeleteRoleMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRolesMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useRolesTableColumns();
  const selectedCount = Object.keys(rowSelection).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) => {
      const name = (role.name || '').toLowerCase();
      const comment = (role.comment || role.description || '').toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [roles, globalFilter]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('roles.confirmBulkDelete'))) return;
    await bulkDelete(ids).unwrap();
    setRowSelection({});
  }, [rowSelection, bulkDelete, t]);

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Shield size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('roles.count', { count: roles.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('roles.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="roles-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t('roles.empty')}
              </Text>
            ) : (
              filtered.map((role) => (
                <Flex
                  key={role.id}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="roles-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{role.name}</Text>
                      <Text as="span" className={cls.comment}>
                        {role.comment || role.description || '-'}
                      </Text>
                    </VStack>
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
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="roles-table-scroll"
        >
          <DataTable
            className={cls.table}
            data={roles}
            columns={columns}
            getRowId={(row) => String(row.id)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('roles.empty')}
            exportFilename="roles_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

RolesTable.displayName = 'RolesTable';
