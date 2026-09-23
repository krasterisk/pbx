import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Music, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
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
import { useGetMohClassesQuery, useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { mohActions } from '../../model/slice/mohSlice';
import { useMohTableColumns } from './useMohTableColumns';
import cls from './MohTable.module.scss';

const PAGE_SIZE = 50;

export const MohTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: mohClasses = [], isLoading } = useGetMohClassesQuery();
  const [deleteMoh] = useDeleteMohClassMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const [isDeleting, setIsDeleting] = useState(false);
  const columns = useMohTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return mohClasses;
    return mohClasses.filter((moh) => {
      const name = (moh.displayName || '').toLowerCase();
      const sort = (moh.sort || '').toLowerCase();
      return name.includes(q) || sort.includes(q);
    });
  }, [mohClasses, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = mohClasses.find((moh) => moh.name === id);
        return row?.displayName || id;
      }),
    [selection.selectedIds, mohClasses],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const names = selection.selectedIds;
    if (!names.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(names.map((name) => deleteMoh(name).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteMoh]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof mohClasses)[number]>) => (
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
      i18nNs="moh"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Music size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('moh.count', { count: mohClasses.length })}</Text>
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
            {t('moh.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="moh-search"
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
                {t('moh.empty.title')}
              </Text>
            ) : (
              filtered.map((moh) => (
                <Flex
                  key={moh.name}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="moh-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <HStack gap="8" align="center">
                        <Music size={16} className={cls.musicIcon} />
                        <Text as="span" className={cls.name}>{moh.displayName}</Text>
                      </HStack>
                      <Text as="span" className={cls.tracksBadge}>
                        {moh.entries?.length || 0}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(mohActions.openEditModal(moh))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          const confirmed = window.confirm(
                            t('moh.confirmDelete').replace('{{name}}', moh.displayName),
                          );
                          if (confirmed) {
                            deleteMoh(moh.name);
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
          data-testid="moh-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            data={mohClasses}
            columns={columns}
            getRowId={(row) => row.name}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('moh.empty.title')}
            exportFilename="moh_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

MohTable.displayName = 'MohTable';
