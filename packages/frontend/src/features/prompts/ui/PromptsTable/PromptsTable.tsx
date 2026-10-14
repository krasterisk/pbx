import { TableCard } from "@/shared/ui";

import type { IPrompt } from "@/entities/prompt";
import {
  useBulkDeletePromptsMutation,
  useDeletePromptMutation,
  useGetPromptsQuery,
} from "@/shared/api/endpoints/promptsApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableRowAction, TableRowActions, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Play, Square, Volume2 } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  getPromptsIsModalOpen,
  getPromptsModalMode,
} from "../../model/selectors/promptsSelectors";
import { promptsActions } from "../../model/slice/promptsSlice";
import { PromptEditModal } from "../PromptEditModal/PromptEditModal";
import { PromptRecordModal } from "../PromptRecordModal/PromptRecordModal";
import { PromptSynthesizeModal } from "../PromptSynthesizeModal/PromptSynthesizeModal";
import { PromptUploadModal } from "../PromptUploadModal/PromptUploadModal";
import cls from "./PromptsTable.module.scss";
import { usePromptsTableColumns } from "./usePromptsTableColumns";

const PAGE_SIZE = 50;

export const PromptsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: prompts = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetPromptsQuery();
  const [deletePrompt] = useDeletePromptMutation();
  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeletePromptsMutation();

  const isModalOpen = useAppSelector(getPromptsIsModalOpen);
  const modalMode = useAppSelector(getPromptsModalMode);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(
    (prompt: IPrompt) => {
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
        toast.error(t("promptsPage.playError"));
      };
      audioRef.current = audio;
      setPlayingId(prompt.uid);
      audio.play().catch(() => {
        setPlayingId(null);
        audioRef.current = null;
        toast.error(t("promptsPage.playError"));
      });
    },
    [playingId, t],
  );

  const handleDelete = useCallback(
    async (prompt: IPrompt) => {
      if (
        !window.confirm(
          t("promptsPage.confirmDelete", {
            name: prompt.comment || prompt.filename,
          }),
        )
      ) {
        return;
      }
      await deletePrompt(prompt.uid);
    },
    [deletePrompt, t],
  );

  const columns = usePromptsTableColumns({
    playingId,
    onPlay: handlePlay,
    onDelete: handleDelete,
  });

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((prompt) => {
      const name = (prompt.comment || prompt.filename || "").toLowerCase();
      const description = (prompt.description || "").toLowerCase();
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
          title={t("promptsPage.play")}
          aria-label={t("promptsPage.play")}
          onClick={() => handlePlay(prompt)}
        >
          {isPlaying ? <Square /> : <Play />}
        </TableRowAction>
      </TableRowActions>
    );
  };

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Volume2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("promptsPage.count", { count: prompts.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="prompts-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: prompts,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "prompts_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("promptsPage.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
      </HStack>
    </Flex>
  );

  const modals = (
    <>
      {isModalOpen && modalMode === "upload" && (
        <PromptUploadModal
          isOpen
          onClose={() => dispatch(promptsActions.closeModal())}
        />
      )}
      {isModalOpen && modalMode === "record" && (
        <PromptRecordModal
          isOpen
          onClose={() => dispatch(promptsActions.closeModal())}
        />
      )}
      {isModalOpen && modalMode === "edit" && (
        <PromptEditModal
          isOpen
          onClose={() => dispatch(promptsActions.closeModal())}
        />
      )}
      {isModalOpen && modalMode === "synthesize" && (
        <PromptSynthesizeModal
          isOpen
          onClose={() => dispatch(promptsActions.closeModal())}
        />
      )}
      {bulkDeleteDialog}
    </>
  );

  if (isListLoadError)
    return (
      <QueryErrorState
        message={t("common.queryLoadError")}
        onRetry={() => void retryListLoad()}
      />
    );
  if (isLoading) {
    return (
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
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
      <Card
        className={[tableStyles.surface, cls.card].join(" ")}
        data-testid="hybrid-table"
        data-hybrid="mobile-card"
      >
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t("promptsPage.empty")}
              </Text>
            ) : (
              filtered.map((prompt) => (
                <TableCard
                  onActivate={() =>
                    dispatch(promptsActions.openEditModal(prompt))
                  }
                  key={prompt.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="prompts-mobile-card"
                  selection={selection.cardSelection(
                    String(prompt.uid),
                    t("common.selectRowAria", { index: String(prompt.uid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {prompt.comment || prompt.filename}
                      </Text>
                      <Text as="span" className={cls.comment}>
                        {prompt.source_type === "tts"
                          ? t("promptsPage.type.tts")
                          : t("promptsPage.type.file")}
                      </Text>
                      {prompt.description?.trim() ? (
                        <Text as="span" className={cls.comment}>
                          {prompt.description}
                        </Text>
                      ) : null}
                    </VStack>
                    {renderRowActions(prompt)}
                  </HStack>
                </TableCard>
              ))
            )}
          </VStack>
        </CardContent>
        {modals}
      </Card>
    );
  }

  return (
    <Card
      className={[tableStyles.surface, cls.card].join(" ")}
      data-testid="hybrid-table"
      data-hybrid="overflow-x-auto"
    >
      <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="prompts-table-scroll"
        >
          <Table
            onRowClick={(prompt) =>
              dispatch(promptsActions.openEditModal(prompt))
            }
            surface={false}
            showSearch={false}
            showExport={false}
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
            emptyText={t("promptsPage.empty")}
            exportFilename="prompts_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {modals}
    </Card>
  );
});

PromptsTable.displayName = "PromptsTable";
