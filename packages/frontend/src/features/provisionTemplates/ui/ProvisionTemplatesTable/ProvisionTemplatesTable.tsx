import { TableCard } from "@/shared/ui";

import {
  useBulkDeleteProvisionTemplatesMutation,
  useGetProvisionTemplatesQuery,
} from "@/shared/api/api";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { FileCode, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { provisionTemplatesActions } from "../../model/slice/provisionTemplatesSlice";
import cls from "./ProvisionTemplatesTable.module.scss";
import { useProvisionTemplatesTableColumns } from "./useProvisionTemplatesTableColumns";

const PAGE_SIZE = 50;

export const ProvisionTemplatesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: templates = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetProvisionTemplatesQuery();

  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteProvisionTemplatesMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const columns = useProvisionTemplatesTableColumns();

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((tpl) => {
      const name = (tpl.name || "").toLowerCase();
      const vendor = (tpl.vendor || "").toLowerCase();
      const model = (tpl.model || "").toLowerCase();
      return name.includes(q) || vendor.includes(q) || model.includes(q);
    });
  }, [templates, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = templates.find((tpl) => String(tpl.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, templates],
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
      i18nNs="provisionTemplates"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <FileCode size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("provisionTemplates.count", { count: templates.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="templates-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: templates,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "provision_templates_export",
          }}
          selection={selection}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("provisionTemplates.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
      </HStack>
    </Flex>
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
                {t("provisionTemplates.empty")}
              </Text>
            ) : (
              filtered.map((tpl) => (
                <TableCard
                  onActivate={() =>
                    dispatch(provisionTemplatesActions.openEditModal(tpl))
                  }
                  key={tpl.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="provision-templates-mobile-card"
                  selection={selection.cardSelection(
                    String(tpl.uid),
                    t("common.selectRowAria", { index: String(tpl.uid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {tpl.name}
                      </Text>
                      <Text as="span" className={cls.muted}>
                        {[tpl.vendor, tpl.model].filter(Boolean).join(" · ") ||
                          "-"}
                      </Text>
                    </VStack>
                  </HStack>
                </TableCard>
              ))
            )}
          </VStack>
        </CardContent>
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
          data-testid="provision-templates-table-scroll"
        >
          <Table
            onRowClick={(tpl) =>
              dispatch(provisionTemplatesActions.openEditModal(tpl))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={templates}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("provisionTemplates.empty")}
            exportFilename="provision_templates_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

ProvisionTemplatesTable.displayName = "ProvisionTemplatesTable";
