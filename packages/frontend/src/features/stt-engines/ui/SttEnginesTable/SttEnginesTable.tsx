import { TableCard } from "@/shared/ui";

import type { ISttEngine } from "@/entities/engines";
import {
  useBulkDeleteSttEnginesMutation,
  useGetSttEnginesQuery,
} from "@/shared/api/endpoints/sttEnginesApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Mic } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getSttEnginesIsModalOpen,
  getSttEnginesSelectedEngine,
} from "../../model/selectors/sttEnginesSelectors";
import { sttEnginesActions } from "../../model/slice/sttEnginesSlice";
import { SttEngineFormModal } from "../SttEngineFormModal/SttEngineFormModal";
import cls from "./SttEnginesTable.module.scss";
import { useSttEnginesTableColumns } from "./useSttEnginesTableColumns";

const PAGE_SIZE = 50;

export const SttEnginesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: engines = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetSttEnginesQuery();

  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteSttEnginesMutation();
  const isModalOpen = useAppSelector(getSttEnginesIsModalOpen);
  const editEngine = useAppSelector(getSttEnginesSelectedEngine);
  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const columns = useSttEnginesTableColumns();

  const typeLabels: Record<string, string> = {
    google: t("sttEngines.typeGoogle"),
    yandex: t("sttEngines.typeYandex"),
    custom: t("sttEngines.typeCustom"),
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
      i18nNs="sttEngines"
    />
  );

  const renderRowActions = (engine: ISttEngine) => null;

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Mic size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("sttEngines.count", { count: engines.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="stt-engines-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: engines,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "stt_engines_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("sttEngines.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
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
                {t("sttEngines.empty")}
              </Text>
            ) : (
              filtered.map((engine) => (
                <TableCard
                  onActivate={() =>
                    dispatch(sttEnginesActions.openEditModal(engine))
                  }
                  key={engine.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="stt-engines-mobile-card"
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
          data-testid="stt-engines-table-scroll"
        >
          <Table
            onRowClick={(engine) =>
              dispatch(sttEnginesActions.openEditModal(engine))
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
            emptyText={t("sttEngines.empty")}
            exportFilename="stt_engines_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {modal}
      {bulkDeleteDialog}
    </Card>
  );
});

SttEnginesTable.displayName = "SttEnginesTable";
