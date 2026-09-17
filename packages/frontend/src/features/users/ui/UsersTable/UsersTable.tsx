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
import { usersPageActions } from '../../model/slice/usersPageSlice';
import { useUsersTableColumns } from './useUsersTableColumns';
import cls from './UsersTable.module.scss';

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
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

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
  const selectedCount = Object.keys(rowSelection).length;

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

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('users.confirmBulkDelete'))) return;
    await bulkDelete(ids).unwrap();
    setRowSelection({});
  }, [rowSelection, bulkDelete, t]);

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
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('users.deleteSelected', { count: selectedCount })}
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
            className={cls.table}
            data={users as IUser[]}
            columns={columns}
            getRowId={(row) => String(row.uniqueid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('users.empty')}
            exportFilename="users_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

UsersTable.displayName = 'UsersTable';
