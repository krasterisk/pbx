import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { ISttEngine } from '@/entities/engines';
import { SttEngineFormModal } from '../SttEngineFormModal/SttEngineFormModal';
import { sttEnginesActions } from '../../model/slice/sttEnginesSlice';
import { getSttEnginesIsModalOpen, getSttEnginesSelectedEngine } from '../../model/selectors/sttEnginesSelectors';
import { useSttEnginesTableColumns } from './useSttEnginesTableColumns';
import cls from './SttEnginesTable.module.scss';

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
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const columns = useSttEnginesTableColumns();
  const selectedCount = Object.keys(rowSelection).length;

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

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('sttEngines.confirmBulkDelete'))) return;
    await bulkDelete(ids).unwrap();
    setRowSelection({});
  }, [rowSelection, bulkDelete, t]);

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
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('sttEngines.deleteSelected', { count: selectedCount })}
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
            className={cls.table}
            columns={columns}
            data={engines}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('sttEngines.empty')}
            exportFilename="stt_engines_export"
          />
        </Flex>
      </CardContent>
      {modal}
    </Card>
  );
});

SttEnginesTable.displayName = 'SttEnginesTable';
