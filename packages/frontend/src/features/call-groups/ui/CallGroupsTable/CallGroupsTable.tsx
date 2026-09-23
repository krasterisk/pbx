import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { UsersRound, Search, Loader2, Trash2, Pencil, Copy } from 'lucide-react';
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
  useGetCallGroupsQuery,
  useDeleteCallGroupMutation,
} from '@/shared/api/endpoints/callGroupApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import { formatCallGroupStrategy, useCallGroupsTableColumns } from './useCallGroupsTableColumns';
import cls from './CallGroupsTable.module.scss';

const PAGE_SIZE = 50;

export const CallGroupsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: callGroups = [], isLoading } = useGetCallGroupsQuery();
  const [deleteCallGroup] = useDeleteCallGroupMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useCallGroupsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return callGroups;
    return callGroups.filter((row) => {
      const name = (row.name || '').toLowerCase();
      const strategy = (row.strategy || '').toLowerCase();
      const exten = (row.exten || '').toLowerCase();
      return name.includes(q) || strategy.includes(q) || exten.includes(q);
    });
  }, [callGroups, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = callGroups.find((group) => String(group.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, callGroups],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteCallGroup(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteCallGroup]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof callGroups)[number]>) => (
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
      i18nNs="callGroups"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <UsersRound size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('callGroups.count', { count: callGroups.length })}</Text>
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
            {t('callGroups.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="call-groups-search"
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
                {t('callGroups.noGroups')}
              </Text>
            ) : (
              filtered.map((group) => {
                const memberCount = group.members?.length ?? 0;
                return (
                  <Flex
                    key={group.uid}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid="call-groups-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text as="span" className={cls.name}>{group.name}</Text>
                        <Text as="span" className={cls.muted}>
                          {formatCallGroupStrategy(group.strategy, t)}
                          {' · '}
                          {memberCount} {t('callGroups.members')}
                        </Text>
                      </VStack>
                      <TableRowActions>
                        <TableRowAction
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() => dispatch(callGroupsPageActions.openEditModal(group.uid))}
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          title={t('common.copy')}
                          aria-label={t('common.copy')}
                          onClick={() => dispatch(callGroupsPageActions.openCopyModal(group.uid))}
                        >
                          <Copy />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onClick={() => {
                            if (window.confirm(t('callGroups.confirmDelete', { name: group.name }))) {
                              deleteCallGroup(group.uid);
                            }
                          }}
                        >
                          <Trash2 />
                        </TableRowAction>
                      </TableRowActions>
                    </HStack>
                  </Flex>
                );
              })
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
          data-testid="call-groups-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={callGroups}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('callGroups.noGroups')}
            exportFilename="call_groups_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

CallGroupsTable.displayName = 'CallGroupsTable';
