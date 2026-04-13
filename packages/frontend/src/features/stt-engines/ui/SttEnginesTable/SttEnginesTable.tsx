import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Loader2, Mic } from 'lucide-react';
import { Button, DataTable, Card, CardHeader, CardContent, HStack } from '@/shared/ui';
import { ISttEngine } from '@/entities/engines';
import { useGetSttEnginesQuery, useDeleteSttEngineMutation, useBulkDeleteSttEnginesMutation } from '@/shared/api/endpoints/sttEnginesApi';
import { SttEngineFormModal } from '../SttEngineFormModal/SttEngineFormModal';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { sttEnginesActions } from '../../model/slice/sttEnginesSlice';
import { getSttEnginesIsModalOpen, getSttEnginesSelectedEngine } from '../../model/selectors/sttEnginesSelectors';

export function SttEnginesTable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: engines = [], isLoading } = useGetSttEnginesQuery();
  const [deleteEngine] = useDeleteSttEngineMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteSttEnginesMutation();

  const isModalOpen = useAppSelector(getSttEnginesIsModalOpen);
  const editEngine = useAppSelector(getSttEnginesSelectedEngine);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleEdit = (engine: ISttEngine) => { dispatch(sttEnginesActions.openEditModal(engine)); };
  
  const handleDelete = useCallback(async (engine: ISttEngine) => {
    if (!window.confirm(t('sttEngines.confirmDelete', { name: engine.name }))) return;
    await deleteEngine(engine.uid);
  }, [deleteEngine, t]);

  const typeLabels: Record<string, string> = {
    google: 'Google Speech-to-Text',
    yandex: 'Yandex SpeechKit',
    custom: 'Custom API',
  };

  const columns: ColumnDef<ISttEngine>[] = [
    { accessorKey: 'uid', header: '№', size: 60 },
    { accessorKey: 'name', header: t('sttEngines.name', 'Название') },
    {
      accessorKey: 'type', header: t('sttEngines.type', 'Тип'), size: 180,
      cell: ({ row }) => typeLabels[row.original.type] || row.original.type,
    },
    {
      id: 'actions', header: t('common.actions', 'Действия'), size: 100,
      cell: ({ row }) => (
        <HStack gap="4" align="center">
          <button type="button" className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => handleEdit(row.original)} title={t('common.edit')}>
            <Pencil size={16} />
          </button>
          <button type="button" className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => handleDelete(row.original)} title={t('common.delete')}>
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
            <Mic className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('sttEngines.count', { count: engines.length, defaultValue: `Всего: ${engines.length}` })}
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
          exportFilename="stt_engines_export"
        />
      </CardContent>
      
      {isModalOpen && (
        <SttEngineFormModal
          isOpen={isModalOpen}
          onClose={() => dispatch(sttEnginesActions.closeModal())}
          engine={editEngine}
        />
      )}
    </Card>
  );
}
