import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { AudioLines, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
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
  useBulkDeleteTtsEnginesMutation,
  useDeleteTtsEngineMutation,
  useGetTtsEnginesQuery,
} from '@/shared/api/endpoints/ttsEnginesApi';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import type { ITtsEngine } from '@/entities/engines';
import { TtsEngineFormModal } from '../TtsEngineFormModal/TtsEngineFormModal';
import { ttsEnginesActions } from '../../model/slice/ttsEnginesSlice';
import { getTtsEnginesIsModalOpen, getTtsEnginesSelectedEngine } from '../../model/selectors/ttsEnginesSelectors';
import { useTtsEnginesTableColumns } from './useTtsEnginesTableColumns';
import cls from './TtsEnginesTable.module.scss';

const PAGE_SIZE = 50;

export const TtsEnginesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: engines = [], isLoading } = useGetTtsEnginesQuery();
  const [deleteEngine] = useDeleteTtsEngineMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTtsEnginesMutation();
  const isModalOpen = useAppSelector(getTtsEnginesIsModalOpen);
  const editEngine = useAppSelector(getTtsEnginesSelectedEngine);
  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
  const columns = useTtsEnginesTableColumns();

  const typeLabels: Record<string, string> = {
    google: t('ttsEngines.typeGoogle'),
    yandex: t('ttsEngines.typeYandex'),
    custom: t('ttsEngines.typeCustom'),
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
      i18nNs="ttsEngines"
    />
  );

  const renderRowActions = (engine: ITtsEngine) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => dispatch(ttsEnginesActions.openEditModal(engine))}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => {
          if (window.confirm(t('ttsEngines.confirmDelete', { name: engine.name }))) {
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
        <AudioLines size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('ttsEngines.count', { count: engines.length })}</Text>
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
            {t('ttsEngines.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="tts-engines-search"
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
    <TtsEngineFormModal
      isOpen={isModalOpen}
      onClose={() => dispatch(ttsEnginesActions.closeModal())}
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
                {t('ttsEngines.empty')}
              </Text>
            ) : (
              filtered.map((engine) => (
                <Flex
                  key={engine.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="tts-engines-mobile-card"
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
          data-testid="tts-engines-table-scroll"
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
            emptyText={t('ttsEngines.empty')}
            exportFilename="tts_engines_export"
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

TtsEnginesTable.displayName = 'TtsEnginesTable';
