import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { ITtsEngine } from '@/entities/engines';
import { TtsEngineFormModal } from '../TtsEngineFormModal/TtsEngineFormModal';
import { ttsEnginesActions } from '../../model/slice/ttsEnginesSlice';
import { getTtsEnginesIsModalOpen, getTtsEnginesSelectedEngine } from '../../model/selectors/ttsEnginesSelectors';
import { useTtsEnginesTableColumns } from './useTtsEnginesTableColumns';
import cls from './TtsEnginesTable.module.scss';

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
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const columns = useTtsEnginesTableColumns();
  const selectedCount = Object.keys(rowSelection).length;

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

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('ttsEngines.confirmBulkDelete'))) return;
    await bulkDelete(ids).unwrap();
    setRowSelection({});
  }, [rowSelection, bulkDelete, t]);

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
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('ttsEngines.deleteSelected', { count: selectedCount })}
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
            className={cls.table}
            columns={columns}
            data={engines}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('ttsEngines.empty')}
            exportFilename="tts_engines_export"
          />
        </Flex>
      </CardContent>
      {modal}
    </Card>
  );
});

TtsEnginesTable.displayName = 'TtsEnginesTable';
