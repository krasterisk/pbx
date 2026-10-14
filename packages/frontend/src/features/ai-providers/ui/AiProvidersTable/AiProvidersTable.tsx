import { TableCard } from "@/shared/ui";

import {
  useDeleteAiProviderMutation,
  useDeleteGlobalAiProviderMutation,
  useGetAiProvidersQuery,
  useGetGlobalAiProvidersQuery,
  type AiCapability,
  type IAiProvider,
} from "@/shared/api/endpoints/aiAgentsApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Plug } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import cls from "./AiProvidersTable.module.scss";
import { useAiProvidersTableColumns } from "./useAiProvidersTableColumns";

interface Props {
  onEdit: (provider: IAiProvider) => void;
  scope?: "tenant" | "global";
  capability?: AiCapability;
}

const PAGE_SIZE = 50;

export const AiProvidersTable = memo(
  ({ onEdit, scope = "tenant", capability }: Props) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile(768);
    const tenantQuery = useGetAiProvidersQuery(
      capability ? { capability } : undefined,
      { skip: scope === "global" },
    );
    const globalQuery = useGetGlobalAiProvidersQuery(undefined, {
      skip: scope !== "global",
    });
    const query = scope === "global" ? globalQuery : tenantQuery;
    const providers = (query.data ?? []).filter(
      (provider) => !capability || provider.capabilities?.includes(capability),
    );
    const isLoading = query.isLoading;
    const [deleteTenant] = useDeleteAiProviderMutation();
    const [deleteGlobal] = useDeleteGlobalAiProviderMutation();
    const deleteProvider = scope === "global" ? deleteGlobal : deleteTenant;
    const [globalFilter, setGlobalFilter] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const selection = useCrossPageRowSelection({ globalFilter });
    const columns = useAiProvidersTableColumns({ onEdit });

    const selectedLabels = useMemo(
      () =>
        selection.selectedIds.map((id) => {
          const row = providers.find((provider) => String(provider.uid) === id);
          return row?.name || id;
        }),
      [selection.selectedIds, providers],
    );

    const filtered = useMemo(() => {
      const q = globalFilter.trim().toLowerCase();
      if (!q) return providers;
      return providers.filter((provider) => {
        const name = (provider.name || "").toLowerCase();
        const vendor = (provider.vendor || "").toLowerCase();
        return name.includes(q) || vendor.includes(q);
      });
    }, [providers, globalFilter]);

    const renderRowActions = (provider: IAiProvider) => null;

    const handleConfirmBulkDelete = useCallback(async () => {
      const ids = selection.selectedIds.map(Number);
      if (!ids.length) return;
      setIsDeleting(true);
      try {
        await Promise.all(ids.map((id) => deleteProvider(id).unwrap()));
        selection.afterBulkDelete();
      } finally {
        setIsDeleting(false);
      }
    }, [selection, deleteProvider]);



    const bulkDeleteDialog = (
      <BulkDeleteDialog
        open={selection.bulkDeleteOpen}
        onOpenChange={selection.setBulkDeleteOpen}
        labels={selectedLabels}
        allMatching={selection.allMatchingSelected}
        hasFilter={globalFilter.trim().length > 0}
        isDeleting={isDeleting}
        onConfirm={handleConfirmBulkDelete}
        i18nNs="aiProviders"
      />
    );

    const toolbar = (
      <Flex justify="between" align="center" className={cls.toolbar} max>
        <HStack gap="8" align="center">
          <Plug size={20} className={cls.toolbarIcon} />
          <Text className={cls.count}>
            {t("aiProviders.count", { count: providers.length })}
          </Text>
        </HStack>
        <HStack gap="8" align="center" className={cls.toolbarActions}>
          <TableToolbar
            tableRef={selection.tableRef}
            searchId="ai-providers-search"
            searchPlaceholder={t("common.search")}
            searchValue={globalFilter}
            onSearchChange={(value) => setGlobalFilter(value)}
            exportTable={{
              data: providers,
              columns: columns,
              getRowId: (row) => String(row.uid),
              globalFilter: globalFilter,
              rowSelection: selection.rowSelection,
              filename: "ai_providers",
            }}
            selection={selection}

            onDeleteSelected={selection.openBulkDelete}
            deleteDisabled={isDeleting}
            deleteLabel={t("aiProviders.deleteSelected", {
              count: selection.selectedCount,
            })}
          />
        </HStack>
      </Flex>
    );

    if (query.isError)
      return (
        <QueryErrorState
          message={t("common.queryLoadError")}
          onRetry={() => void query.refetch()}
        />
      );
    if (isLoading) {
      return (
        <Card className={[tableStyles.surface, cls.card].join(" ")}>
          <CardHeader className={tableStyles.toolbarPanel}>
            {toolbar}
          </CardHeader>
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
          <CardHeader className={tableStyles.toolbarPanel}>
            {toolbar}
          </CardHeader>
          <CardContent>
            <VStack gap="8" max className={cls.mobileList}>
              {filtered.length === 0 ? (
                <Text variant="muted" className={cls.mobileEmpty}>
                  {t("aiProviders.empty")}
                </Text>
              ) : (
                filtered.map((provider) => (
                  <TableCard
                    onActivate={() => onEdit(provider)}
                    key={provider.uid}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid="ai-providers-mobile-card"
                    selection={selection.cardSelection(
                      String(provider.uid),
                      t("common.selectRowAria", {
                        index: String(provider.uid),
                      }),
                    )}
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text as="span" className={cls.name}>
                          {provider.name}
                        </Text>
                        <Text as="span" className={cls.cell}>
                          {provider.vendor}
                        </Text>
                        <Text
                          as="span"
                          className={
                            provider.enabled ? cls.statusOn : cls.statusOff
                          }
                        >
                          {provider.enabled
                            ? t("aiProviders.statusOn")
                            : t("aiProviders.statusOff")}
                        </Text>
                      </VStack>
                      {renderRowActions(provider)}
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
            data-testid="ai-providers-table-scroll"
          >
            <Table
              onRowClick={(provider) => onEdit(provider)}
              surface={false}
              showSearch={false}
              showExport={false}
              ref={selection.tableRef}
              className={cls.table}
              columns={columns}
              data={providers}
              getRowId={(row) => String(row.uid)}
              selectable
              rowSelection={selection.rowSelection}
              onRowSelectionChange={selection.onRowSelectionChange}
              globalFilter={globalFilter}
              pageSize={PAGE_SIZE}
              emptyText={t("aiProviders.empty")}
              exportFilename="ai_providers"
              selectAllAriaLabel={t("common.selectPageAria")}

            />
          </Flex>
        </CardContent>
        {bulkDeleteDialog}
      </Card>
    );
  },
);

AiProvidersTable.displayName = "AiProvidersTable";
