import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { ListOrdered, Search, Loader2, Trash2, Pencil, Copy } from 'lucide-react';
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
import { useGetQueuesQuery, useDeleteQueueMutation } from '@/shared/api/endpoints/queueApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import { formatQueueStrategy, useQueuesTableColumns } from './useQueuesTableColumns';
import cls from './QueuesTable.module.scss';

const PAGE_SIZE = 50;

export const QueuesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: queues = [], isLoading } = useGetQueuesQuery();
  const [deleteQueue] = useDeleteQueueMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useQueuesTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return queues;
    return queues.filter((row) => {
      const exten = (row.exten || row.name || '').toLowerCase();
      const display = (row.display_name || '').toLowerCase();
      const strategy = (row.strategy || '').toLowerCase();
      return exten.includes(q) || display.includes(q) || strategy.includes(q);
    });
  }, [queues, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = queues.find((q) => q.name === id);
        return row?.display_name || row?.exten || row?.name || id;
      }),
    [selection.selectedIds, queues],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const names = selection.selectedIds;
    if (!names.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(names.map((name) => deleteQueue(name).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteQueue]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof queues)[number]>) => (
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
      i18nNs="queues"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <ListOrdered size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('queues.count', { count: queues.length })}</Text>
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
            {t('queues.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="queues-search"
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
                {t('queues.noQueues')}
              </Text>
            ) : (
              filtered.map((row) => (
                <Flex
                  key={row.name}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="queues-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.exten}>{row.exten || row.name}</Text>
                      <Text as="span" className={cls.name}>{row.display_name || '-'}</Text>
                      <Text as="span" className={cls.muted}>
                        {formatQueueStrategy(row.strategy, t)}
                        {' · '}
                        {row.memberCount || 0} {t('queues.members')}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(queuesPageActions.openEditModal(row.name))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        title={t('common.copy')}
                        aria-label={t('common.copy')}
                        onClick={() => dispatch(queuesPageActions.openCopyModal(row.name))}
                      >
                        <Copy />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('queues.confirmDelete', { name: row.name }))) {
                            deleteQueue(row.name);
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
          data-testid="queues-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={queues}
            columns={columns}
            getRowId={(row) => row.name}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('queues.noQueues')}
            exportFilename="queues_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

QueuesTable.displayName = 'QueuesTable';
