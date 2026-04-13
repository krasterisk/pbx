import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Loader2, AudioLines } from 'lucide-react';
import { Button, DataTable, Card, CardHeader, CardContent, HStack } from '@/shared/ui';
import { ITtsEngine } from '@/entities/engines';
import { useGetTtsEnginesQuery, useDeleteTtsEngineMutation, useBulkDeleteTtsEnginesMutation } from '@/shared/api/endpoints/ttsEnginesApi';
import { TtsEngineFormModal } from '../TtsEngineFormModal/TtsEngineFormModal';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { ttsEnginesActions } from '../../model/slice/ttsEnginesSlice';
import { getTtsEnginesIsModalOpen, getTtsEnginesSelectedEngine } from '../../model/selectors/ttsEnginesSelectors';

export function TtsEnginesTable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: engines = [], isLoading } = useGetTtsEnginesQuery();
  const [deleteEngine] = useDeleteTtsEngineMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTtsEnginesMutation();

  const isModalOpen = useAppSelector(getTtsEnginesIsModalOpen);
  const editEngine = useAppSelector(getTtsEnginesSelectedEngine);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleEdit = (engine: ITtsEngine) => {
    dispatch(ttsEnginesActions.openEditModal(engine));
  };


  const handleDelete = useCallback(async (engine: ITtsEngine) => {
    if (!window.confirm(t('ttsEngines.confirmDelete', { name: engine.name }))) return;
    await deleteEngine(engine.uid);
  }, [deleteEngine, t]);

  const typeLabels: Record<string, string> = {
    google: t('ttsEngines.typeGoogle', 'Google Cloud TTS'),
    yandex: t('ttsEngines.typeYandex', 'Yandex SpeechKit'),
    custom: t('ttsEngines.typeCustom', 'Custom API'),
  };

  const columns: ColumnDef<ITtsEngine>[] = [
    {
      accessorKey: 'uid',
      header: '№',
      size: 60,
    },
    {
      accessorKey: 'name',
      header: t('ttsEngines.name', 'Название'),
    },
    {
      accessorKey: 'type',
      header: t('ttsEngines.type', 'Тип'),
      cell: ({ row }) => typeLabels[row.original.type] || row.original.type,
      size: 180,
    },
    {
      id: 'actions',
      header: t('common.actions', 'Действия'),
      size: 100,
      cell: ({ row }) => (
        <HStack gap="4" align="center">
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => handleEdit(row.original)}
            title={t('common.edit', 'Редактировать')}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => handleDelete(row.original)}
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 size={16} />
          </button>
        </HStack>
      ),
    },
  ];

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <AudioLines className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('ttsEngines.count', { count: engines.length, defaultValue: `Всего: ${engines.length}` })}
            </span>
          </HStack>
          <HStack gap="12" align="center" className="w-full sm:w-auto">
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={handleBulkDelete}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
              </Button>
            )}
          </HStack>
        </HStack>
      </CardHeader>
      
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={engines}
          getRowId={(row: any) => String(row.uid)}
          selectable={true}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          emptyText={t('common.noData')}
          exportFilename="tts_engines_export"
        />
      </CardContent>

      {isModalOpen && (
        <TtsEngineFormModal
          isOpen={isModalOpen}
          onClose={() => dispatch(ttsEnginesActions.closeModal())}
          engine={editEngine}
        />
      )}
    </Card>
  );
}


