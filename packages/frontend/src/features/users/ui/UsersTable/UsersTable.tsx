import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
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
  TableSelectionBanner,
  BulkDeleteDialog,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetUsersQuery,
  useGetRolesQuery,
  useGetNumbersQuery,
  useBulkDeleteUsersMutation,
  useDeleteUserMutation,
} from '@/shared/api/api';
import type { IUser } from '@/entities/User';
import { UserLevelBadge } from '@/entities/User';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { useUsersTableColumns } from './useUsersTableColumns';
import cls from './UsersTable.module.scss';

const PAGE_SIZE = 50;

export const UsersTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: users = [], isLoading } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const { data: numbers = [] } = useGetNumbersQuery();
  const [deleteUser] = useDeleteUserMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteUsersMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });

  const rolesMap = useMemo(() => {
    const map: Record<number, string> = {};
    roles.forEach((r) => { map[r.id] = r.name; });
    return map;
  }, [roles]);

  const numbersMap = useMemo(() => {
    const map: Record<number, string> = {};
    numbers.forEach((n) => { map[n.id] = n.name; });
    return map;
  }, [numbers]);

  const columns = useUsersTableColumns({ rolesMap, numbersMap });

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return users as IUser[];
    return (users as IUser[]).filter((user) => {
      const name = (user.name || '').toLowerCase();
      const login = (user.login || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const exten = (user.exten || '').toLowerCase();
      return name.includes(q) || login.includes(q) || email.includes(q) || exten.includes(q);
    });
  }, [users, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = (users as IUser[]).find((u) => String(u.uniqueid) === id);
        return row?.login || row?.name || id;
      }),
    [selection.selectedIds, users],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<IUser>) => (
      <TableSelectionBanner
        table={table}
        pageSize={PAGE_SIZE}
        allMatchingSelected={selection.allMatchingSelected}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        onSelectAllMatching={selection.selectAllMatching}
        onClear={selection.clearSelection}
      />
    ),
    [selection],
  );

  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="users"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Shield size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('users.count', { count: users.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={selection.openBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('users.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="users-search"
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
                {t('users.empty')}
              </Text>
            ) : (
              filtered.map((user) => (
                <Flex
                  key={user.uniqueid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="users-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{user.name}</Text>
                      <Text as="span" className={cls.exten}>{user.exten || '-'}</Text>
                      <Text as="span" className={cls.muted}>{user.email || '-'}</Text>
                      <UserLevelBadge level={user.level} />
                    </VStack>
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
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
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
          data-testid="users-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={users as IUser[]}
            columns={columns}
            getRowId={(row) => String(row.uniqueid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('users.empty')}
            exportFilename="users_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

UsersTable.displayName = 'UsersTable';
