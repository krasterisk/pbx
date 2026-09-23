import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Calendar, Search, Loader2, Trash2, Pencil, Copy } from 'lucide-react';
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
  useGetTimeGroupsQuery,
  useDeleteTimeGroupMutation,
  useBulkDeleteTimeGroupsMutation,
} from '@/shared/api/endpoints/timeGroupApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { timeGroupsActions } from '../../model/slice/timeGroupsSlice';
import { useTimeGroupsTableColumns, formatTimeGroupInterval } from './useTimeGroupsTableColumns';
import cls from './TimeGroupsTable.module.scss';

const PAGE_SIZE = 50;

export const TimeGroupsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: timeGroups = [], isLoading } = useGetTimeGroupsQuery();
  const [deleteTimeGroup] = useDeleteTimeGroupMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTimeGroupsMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useTimeGroupsTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return timeGroups;
    return timeGroups.filter((tg) => {
      const name = (tg.name || '').toLowerCase();
      const comment = (tg.comment || '').toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [timeGroups, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = timeGroups.find((tg) => String(tg.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, timeGroups],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof timeGroups)[number]>) => (
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
      i18nNs="timeGroups"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Calendar size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('timeGroups.count', { count: timeGroups.length })}</Text>
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
            {t('timeGroups.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="timegroups-search"
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
                {t('timeGroups.empty')}
              </Text>
            ) : (
              filtered.map((tg) => (
                <Flex
                  key={tg.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="timegroups-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{tg.name}</Text>
                      {tg.comment ? (
                        <Text as="span" className={cls.comment}>{tg.comment}</Text>
                      ) : null}
                      {(tg.intervals || []).length === 0 ? (
                        <Text as="span" className={cls.noIntervals}>
                          {t('timeGroups.noIntervals')}
                        </Text>
                      ) : (
                        (tg.intervals || []).map((interval, i) => (
                          <Text as="span" key={i} className={cls.intervalChip}>
                            {formatTimeGroupInterval(interval, t)}
                          </Text>
                        ))
                      )}
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(timeGroupsActions.openEditModal(tg))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        title={t('common.copy')}
                        aria-label={t('common.copy')}
                        onClick={() => dispatch(timeGroupsActions.openCopyModal(tg))}
                      >
                        <Copy />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('timeGroups.confirmDelete'))) {
                            deleteTimeGroup(tg.uid);
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
          data-testid="timegroups-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={timeGroups}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('timeGroups.empty')}
            exportFilename="timegroups_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

TimeGroupsTable.displayName = 'TimeGroupsTable';
