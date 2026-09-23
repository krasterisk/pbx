import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { Loader2, Mic, Pencil, Search, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  TableRowAction,
  TableRowActions,
  TableSelectionBanner,
  BulkDeleteDialog,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useBulkDeleteSttEnginesMutation,
  useDeleteSttEngineMutation,
  useGetSttEnginesQuery,
} from '@/shared/api/endpoints/sttEnginesApi';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import type { ISttEngine } from '@/entities/engines';
import { SttEngineFormModal } from '../SttEngineFormModal/SttEngineFormModal';
import { sttEnginesActions } from '../../model/slice/sttEnginesSlice';
import { getSttEnginesIsModalOpen, getSttEnginesSelectedEngine } from '../../model/selectors/sttEnginesSelectors';
import { useSttEnginesTableColumns } from './useSttEnginesTableColumns';
import cls from './SttEnginesTable.module.scss';

const PAGE_SIZE = 50;

export const SttEnginesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: engines = [], isLoading } = useGetSttEnginesQuery();
  const [deleteEngine] = useDeleteSttEngineMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteSttEnginesMutation();
  const isModalOpen = useAppSelector(getSttEnginesIsModalOpen);
  const editEngine = useAppSelector(getSttEnginesSelectedEngine);
  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const columns = useSttEnginesTableColumns();

  const typeLabels: Record<string, string> = {
    google: t('sttEngines.typeGoogle'),
    yandex: t('sttEngines.typeYandex'),
    custom: t('sttEngines.typeCustom'),
  };

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return engines;
    return engines.filter((engine) => {
      const name = (engine.name || '').toLowerCase();
      const type = (typeLabels[engine.type] || engine.type || '').toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [engines, globalFilter, typeLabels.google, typeLabels.yandex, typeLabels.custom]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = engines.find((engine) => String(engine.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, engines],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof engines)[number]>) => (
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
      i18nNs="sttEngines"
    />
  );

  const renderRowActions = (engine: ISttEngine) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => dispatch(sttEnginesActions.openEditModal(engine))}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => {
          if (window.confirm(t('sttEngines.confirmDelete', { name: engine.name }))) {
            deleteEngine(engine.uid);
          }
        }}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Mic size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('sttEngines.count', { count: engines.length })}</Text>
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
            {t('sttEngines.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="stt-engines-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  const modal = isModalOpen ? (
    <SttEngineFormModal
      isOpen={isModalOpen}
      onClose={() => dispatch(sttEnginesActions.closeModal())}
      engine={editEngine}
    />
  ) : null;

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
        {modal}
        {bulkDeleteDialog}
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
                {t('sttEngines.empty')}
              </Text>
            ) : (
              filtered.map((engine) => (
                <Flex
                  key={engine.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="stt-engines-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{engine.name}</Text>
                      <Text as="span" className={cls.cell}>
                        {typeLabels[engine.type] || engine.type}
                      </Text>
                    </VStack>
                    {renderRowActions(engine)}
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {modal}
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
          data-testid="stt-engines-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            columns={columns}
            data={engines}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('sttEngines.empty')}
            exportFilename="stt_engines_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {modal}
      {bulkDeleteDialog}
    </Card>
  );
});

SttEnginesTable.displayName = 'SttEnginesTable';
