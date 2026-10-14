import { TableCard } from "@/shared/ui";

import type { ITtsEngine } from "@/entities/engines";
import {
  useBulkDeleteTtsEnginesMutation,
  useGetTtsEnginesQuery,
} from "@/shared/api/endpoints/ttsEnginesApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { AudioLines, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getTtsEnginesIsModalOpen,
  getTtsEnginesSelectedEngine,
} from "../../model/selectors/ttsEnginesSelectors";
import { ttsEnginesActions } from "../../model/slice/ttsEnginesSlice";
import { TtsEngineFormModal } from "../TtsEngineFormModal/TtsEngineFormModal";
import cls from "./TtsEnginesTable.module.scss";
import { useTtsEnginesTableColumns } from "./useTtsEnginesTableColumns";

const PAGE_SIZE = 50;

export const TtsEnginesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: engines = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetTtsEnginesQuery();

  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteTtsEnginesMutation();
  const isModalOpen = useAppSelector(getTtsEnginesIsModalOpen);
  const editEngine = useAppSelector(getTtsEnginesSelectedEngine);
  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const columns = useTtsEnginesTableColumns();

  const typeLabels: Record<string, string> = {
    google: t("ttsEngines.typeGoogle"),
    yandex: t("ttsEngines.typeYandex"),
    custom: t("ttsEngines.typeCustom"),
  };

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return engines;
    return engines.filter((engine) => {
      const name = (engine.name || "").toLowerCase();
      const type = (typeLabels[engine.type] || engine.type || "").toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [
    engines,
    globalFilter,
    typeLabels.google,
    typeLabels.yandex,
    typeLabels.custom,
  ]);

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

  const renderRowActions = (engine: ITtsEngine) => null;

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <AudioLines size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("ttsEngines.count", { count: engines.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="tts-engines-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: engines,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "tts_engines_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("ttsEngines.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
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
        {modal}
        {bulkDeleteDialog}
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
                {t("ttsEngines.empty")}
              </Text>
            ) : (
              filtered.map((engine) => (
                <TableCard
                  onActivate={() =>
                    dispatch(ttsEnginesActions.openEditModal(engine))
                  }
                  key={engine.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="tts-engines-mobile-card"
                  selection={selection.cardSelection(
                    String(engine.uid),
                    t("common.selectRowAria", { index: String(engine.uid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {engine.name}
                      </Text>
                      <Text as="span" className={cls.cell}>
                        {typeLabels[engine.type] || engine.type}
                      </Text>
                    </VStack>
                    {renderRowActions(engine)}
                  </HStack>
                </TableCard>
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
          data-testid="tts-engines-table-scroll"
        >
          <Table
            onRowClick={(engine) =>
              dispatch(ttsEnginesActions.openEditModal(engine))
            }
            surface={false}
            showSearch={false}
            showExport={false}
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
            emptyText={t("ttsEngines.empty")}
            exportFilename="tts_engines_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {modal}
      {bulkDeleteDialog}
    </Card>
  );
});

TtsEnginesTable.displayName = "TtsEnginesTable";
