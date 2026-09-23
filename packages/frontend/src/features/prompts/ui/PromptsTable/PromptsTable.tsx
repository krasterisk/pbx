import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Table } from '@tanstack/react-table';
import { toast } from 'react-toastify';
import { Loader2, Pencil, Play, Search, Square, Trash2, Volume2 } from 'lucide-react';
import {
  Button,
  BulkDeleteDialog,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  TableRowAction,
  TableRowActions,
  TableSelectionBanner,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import type { IPrompt } from '@/entities/prompt';
import {
  useBulkDeletePromptsMutation,
  useDeletePromptMutation,
  useGetPromptsQuery,
} from '@/shared/api/endpoints/promptsApi';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { PromptUploadModal } from '../PromptUploadModal/PromptUploadModal';
import { PromptRecordModal } from '../PromptRecordModal/PromptRecordModal';
import { PromptEditModal } from '../PromptEditModal/PromptEditModal';
import { PromptSynthesizeModal } from '../PromptSynthesizeModal/PromptSynthesizeModal';
import { promptsActions } from '../../model/slice/promptsSlice';
import { getPromptsIsModalOpen, getPromptsModalMode } from '../../model/selectors/promptsSelectors';
import { usePromptsTableColumns } from './usePromptsTableColumns';
import cls from './PromptsTable.module.scss';

const PAGE_SIZE = 50;

export const PromptsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: prompts = [], isLoading } = useGetPromptsQuery();
  const [deletePrompt] = useDeletePromptMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeletePromptsMutation();

  const isModalOpen = useAppSelector(getPromptsIsModalOpen);
  const modalMode = useAppSelector(getPromptsModalMode);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter });
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
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
      toast.error(t('promptsPage.playError'));
    };
    audioRef.current = audio;
    setPlayingId(prompt.uid);
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
      toast.error(t('promptsPage.playError'));
    });
  }, [playingId, t]);

  const handleDelete = useCallback(async (prompt: IPrompt) => {
    if (!window.confirm(t('promptsPage.confirmDelete', { name: prompt.comment || prompt.filename }))) {
      return;
    }
    await deletePrompt(prompt.uid);
  }, [deletePrompt, t]);

  const columns = usePromptsTableColumns({ playingId, onPlay: handlePlay, onDelete: handleDelete });

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((prompt) => {
      const name = (prompt.comment || prompt.filename || '').toLowerCase();
      const description = (prompt.description || '').toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [prompts, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = prompts.find((prompt) => String(prompt.uid) === id);
        return row?.comment || row?.filename || id;
      }),
    [selection.selectedIds, prompts],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    await bulkDelete(ids).unwrap();
    selection.afterBulkDelete();
  }, [selection, bulkDelete]);

  const renderSelectionBanner = useCallback(
    (table: Table<IPrompt>) => (
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
      i18nNs="promptsPage"
    />
  );

  const renderRowActions = (prompt: IPrompt) => {
    const isPlaying = playingId === prompt.uid;
    return (
      <TableRowActions>
        <TableRowAction
          title={t('promptsPage.play')}
          aria-label={t('promptsPage.play')}
          onClick={() => handlePlay(prompt)}
        >
          {isPlaying ? <Square /> : <Play />}
        </TableRowAction>
        <TableRowAction
          title={t('common.edit')}
          aria-label={t('common.edit')}
          onClick={() => dispatch(promptsActions.openEditModal(prompt))}
        >
          <Pencil />
        </TableRowAction>
        <TableRowAction
          danger
          title={t('common.delete')}
          aria-label={t('common.delete')}
          onClick={() => handleDelete(prompt)}
        >
          <Trash2 />
        </TableRowAction>
      </TableRowActions>
    );
  };

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Volume2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('promptsPage.count', { count: prompts.length })}</Text>
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
            {t('promptsPage.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="prompts-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  const modals = (
    <>
      {isModalOpen && modalMode === 'upload' && (
        <PromptUploadModal isOpen onClose={() => dispatch(promptsActions.closeModal())} />
      )}
      {isModalOpen && modalMode === 'record' && (
        <PromptRecordModal isOpen onClose={() => dispatch(promptsActions.closeModal())} />
      )}
      {isModalOpen && modalMode === 'edit' && (
        <PromptEditModal isOpen onClose={() => dispatch(promptsActions.closeModal())} />
      )}
      {isModalOpen && modalMode === 'synthesize' && (
        <PromptSynthesizeModal isOpen onClose={() => dispatch(promptsActions.closeModal())} />
      )}
      {bulkDeleteDialog}
    </>
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
        {modals}
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
                {t('promptsPage.empty')}
              </Text>
            ) : (
              filtered.map((prompt) => (
                <Flex
                  key={prompt.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="prompts-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {prompt.comment || prompt.filename}
                      </Text>
                      <Text as="span" className={cls.comment}>
                        {prompt.source_type === 'tts'
                          ? t('promptsPage.type.tts')
                          : t('promptsPage.type.file')}
                      </Text>
                      {prompt.description?.trim() ? (
                        <Text as="span" className={cls.comment}>{prompt.description}</Text>
                      ) : null}
                    </VStack>
                    {renderRowActions(prompt)}
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {modals}
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
          data-testid="prompts-table-scroll"
        >
          <DataTable
            ref={selection.tableRef}
            className={cls.table}
            columns={columns}
            data={prompts}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t('promptsPage.empty')}
            exportFilename="prompts_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {modals}
    </Card>
  );
});

PromptsTable.displayName = 'PromptsTable';
