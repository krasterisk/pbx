import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Upload, Phone, Volume2, Play, Square, Trash2, Loader2 } from 'lucide-react';
import { Button, DataTable, Card, CardHeader, CardContent, HStack } from '@/shared/ui';
import { IPrompt } from '@/entities/prompt';
import { useGetPromptsQuery, useDeletePromptMutation, useBulkDeletePromptsMutation } from '@/shared/api/endpoints/promptsApi';
import { PromptUploadModal } from '../PromptUploadModal/PromptUploadModal';
import { PromptRecordModal } from '../PromptRecordModal/PromptRecordModal';
import cls from './PromptsTable.module.scss';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { promptsActions } from '../../model/slice/promptsSlice';
import { getPromptsIsModalOpen, getPromptsModalMode } from '../../model/selectors/promptsSelectors';

export function PromptsTable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: prompts = [], isLoading } = useGetPromptsQuery();
  const [deletePrompt] = useDeletePromptMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeletePromptsMutation();

  const isModalOpen = useAppSelector(getPromptsIsModalOpen);
  const modalMode = useAppSelector(getPromptsModalMode);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback((prompt: IPrompt) => {
    if (playingId === prompt.uid) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(`/api/prompts/${prompt.uid}/stream`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(prompt.uid);
  }, [playingId]);

  const handleDelete = useCallback(async (prompt: IPrompt) => {
    if (!window.confirm(t('promptsPage.confirmDelete', { name: prompt.comment || prompt.filename }))) return;
    await deletePrompt(prompt.uid);
  }, [deletePrompt, t]);

  const columns: ColumnDef<IPrompt>[] = [
    {
      accessorKey: 'uid',
      header: '№',
      size: 60,
    },
    {
      accessorKey: 'comment',
      header: t('promptsPage.comment', 'Название'),
      cell: ({ row }) => row.original.comment || row.original.filename,
    },
    {
      accessorKey: 'moh',
      header: t('promptsPage.moh', 'MOH'),
      size: 120,
      cell: ({ row }) => row.original.moh || '—',
    },
    {
      id: 'actions',
      header: t('common.actions', 'Действия'),
      size: 100,
      cell: ({ row }) => {
        const prompt = row.original;
        const isPlaying = playingId === prompt.uid;
        return (
          <HStack gap="4" align="center">
            <button
              type="button"
              className={`${cls.audioBtn} ${isPlaying ? cls.playing : ''}`}
              onClick={() => handlePlay(prompt)}
              title={t('promptsPage.play', 'Прослушать')}
            >
              {isPlaying ? <Square size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              className={cls.deleteBtn}
              onClick={() => handleDelete(prompt)}
              title={t('common.delete', 'Удалить')}
            >
              <Trash2 size={16} />
            </button>
          </HStack>
        );
      },
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
            <Volume2 className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('prompts.count', { count: prompts.length, defaultValue: `Всего: ${prompts.length}` })}
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
        data={prompts}
        getRowId={(row: any) => String(row.uid)}
        selectable={true}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        emptyText={t('common.noData')}
        exportFilename="prompts_export"
      />
      </CardContent>

      <PromptUploadModal isOpen={isModalOpen && modalMode === 'upload'} onClose={() => dispatch(promptsActions.closeModal())} />
      <PromptRecordModal isOpen={isModalOpen && modalMode === 'record'} onClose={() => dispatch(promptsActions.closeModal())} />
    </Card>
  );
}


