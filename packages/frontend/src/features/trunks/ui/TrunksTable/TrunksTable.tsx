import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Search, Loader2, Cable, Trash2, Pencil, Copy } from 'lucide-react';
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
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import {
  useGetTrunksQuery,
  useBulkDeleteTrunksMutation,
  useDeleteTrunkMutation,
} from '@/shared/api/endpoints/trunkApi';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { useTrunksTableColumns } from './useTrunksTableColumns';
import cls from './TrunksTable.module.scss';

const PAGE_SIZE = 50;

export const TrunksTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: trunks = [], isLoading } = useGetTrunksQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTrunksMutation();
  const [deleteTrunk] = useDeleteTrunkMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useTrunksTableColumns();

  const registeredCount = trunks.filter(
    (tr) => tr.registrationStatus === 'Registered',
  ).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return trunks;
    return trunks.filter((tr) => {
      const name = (tr.name || '').toLowerCase();
      const host = (tr.host || '').toLowerCase();
      const username = (tr.username || '').toLowerCase();
      const context = (tr.context || '').toLowerCase();
      return name.includes(q) || host.includes(q) || username.includes(q) || context.includes(q);
    });
  }, [trunks, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = trunks.find((tr) => tr.id === id);
        return row?.name || id;
      }),
    [selection.selectedIds, trunks],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds;
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<ITrunkListItem>) => (
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
      i18nNs="trunks"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Cable size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('trunks.count', { count: trunks.length })}</Text>
        {trunks.length > 0 && (
          <Text as="span" className={cls.registeredBadge}>
            {registeredCount} {t('trunks.statusRegistered', 'Registered').toLowerCase()}
          </Text>
        )}
      </HStack>
      <HStack gap="12" align="center" className={cls.toolbarActions}>
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
            {t('common.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="trunks-search"
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
                {t('common.noData')}
              </Text>
            ) : (
              filtered.map((trunk) => {
                const isAuth = trunk.trunkType === 'auth';
                return (
                  <Flex
                    key={trunk.id}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid="trunks-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <HStack gap="8" align="center">
                          <Text className={cls.name}>{trunk.name}</Text>
                          {isAuth ? (
                            <>
                              <Flex className={
                                trunk.registrationStatus === 'Registered'
                                  ? cls.statusDotRegistered
                                  : trunk.registrationStatus === 'Rejected'
                                    ? cls.statusDotRejected
                                    : cls.statusDotUnknown
                              }
                              >
                                {''}
                              </Flex>
                              <Text variant="muted" className={cls.statusUnknown}>
                                {trunk.registrationStatus || 'unknown'}
                              </Text>
                            </>
                          ) : (
                            <Text variant="muted" className={cls.statusUnknown}>IP</Text>
                          )}
                        </HStack>
                        <Text className={cls.mono}>{trunk.host || '-'}</Text>
                        {trunk.context ? (
                          <Text as="span" className={cls.contextChip}>{trunk.context}</Text>
                        ) : null}
                      </VStack>
                      <TableRowActions>
                        <TableRowAction
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() => dispatch(trunksPageActions.openEditModal(trunk))}
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          title={t('common.copy', 'Копировать')}
                          aria-label={t('common.copy', 'Копировать')}
                          onClick={() => dispatch(trunksPageActions.openCopyModal(trunk))}
                        >
                          <Copy />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onClick={() => {
                            if (window.confirm(t('trunks.confirmDelete', { name: trunk.name }))) {
                              deleteTrunk(trunk.id);
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
          data-testid="trunks-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={trunks as ITrunkListItem[]}
            columns={columns}
            getRowId={(row) => row.id}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('common.noData')}
            exportFilename="trunks_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

TrunksTable.displayName = 'TrunksTable';
