import { TableCard, TableCardDetails } from "@/shared/ui";
import { Tooltip } from "@/shared/ui";
import { TableToolbar, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Loader2, Cable, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardContent, Button, Table, Text, TableRowActions, BulkDeleteDialog } from "@/shared/ui";
import { HStack, Flex, VStack } from "@/shared/ui/Stack";
import {
  useGetTrunksQuery,
  useBulkDeleteTrunksMutation,
} from "@/shared/api/endpoints/trunkApi";
import type { ITrunkListItem } from "@/shared/api/endpoints/trunkApi";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import { selectUserLevel, UserLevel } from "@/entities/User";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { trunksPageActions } from "../../model/slice/trunksPageSlice";
import { useTrunksTableColumns } from "./useTrunksTableColumns";
import { TrunkStatus } from "./TrunkStatus";
import { TrunkRegistrationAction } from "./TrunkRegistrationAction";
import { useTrunkRegistration } from "./useTrunkRegistration";
import { trunkRegistrationState } from "./trunkRegistration";
import cls from "./TrunksTable.module.scss";

const PAGE_SIZE = 50;

export const TrunksTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const userLevel = useAppSelector(selectUserLevel);
  const canRegister =
    userLevel === UserLevel.ADMIN || userLevel === UserLevel.SUPERADMIN;
  const isMobile = useIsMobile(768);
  const {
    data,
    isLoading,
    isError,
    refetch: retryListLoad,
  } = useGetTrunksQuery(undefined, {
    pollingInterval: 15000,
    refetchOnMountOrArgChange: true,
  });
  const trunks = useMemo(
    () =>
      (data ?? []).map((trunk) =>
        isError
          ? {
              ...trunk,
              reachabilityStatus: "Unknown" as const,
              registrationStatus: null,
            }
          : trunk,
      ),
    [data, isError],
  );
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteTrunksMutation();

  const [globalFilter, setGlobalFilter] = useState("");
  const selection = useCrossPageRowSelection({ globalFilter });

  const { pendingIds, requestRegistration, requestSelectedRegistration } =
    useTrunkRegistration();
  const columns = useTrunksTableColumns({
    showRegistrationAction: canRegister && selection.selectedCount === 0,
    pendingIds,
    onRegister: requestRegistration,
  });
  const selectedTrunks = useMemo(() => {
    const ids = new Set(selection.selectedIds);
    return trunks.filter((trunk) => ids.has(trunk.id));
  }, [selection.selectedIds, trunks]);
  const eligibleSelected = selectedTrunks.filter(
    (trunk) => trunk.trunkType === "auth",
  );
  const registrationPending = eligibleSelected.some((trunk) =>
    pendingIds.has(trunk.id),
  );
  const registrationDisabled =
    registrationPending || eligibleSelected.length === 0;
  const registrationActionLabel = t("trunks.refreshSelectedRegistration");
  const registrationActionTooltip = registrationPending
    ? t("trunks.registrationInProgress")
    : eligibleSelected.length === 0
      ? t("trunks.registrationNoEligible")
      : registrationActionLabel;

  const registeredCount = trunks.filter(
    (tr) =>
      tr.trunkType === "auth" &&
      trunkRegistrationState(tr.registrationStatus) === "Registered",
  ).length;
  const reachableCount = trunks.filter(
    (tr) => tr.reachabilityStatus === "Reachable",
  ).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return trunks;
    return trunks.filter((tr) => {
      const name = (tr.name || "").toLowerCase();
      const host = (tr.host || "").toLowerCase();
      const username = (tr.username || "").toLowerCase();
      const context = (tr.context || "").toLowerCase();
      return (
        name.includes(q) ||
        host.includes(q) ||
        username.includes(q) ||
        context.includes(q)
      );
    });
  }, [trunks, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = trunks.find((tr) => tr.id === id);
        return row?.name || id;
      }),
    [selection.selectedIds, trunks],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds;
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
      i18nNs="trunks"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Cable size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("trunks.count", { count: trunks.length })}
        </Text>
        {trunks.length > 0 && (
          <Text as="span" className={cls.registeredBadge}>
            {t("trunks.reachableCount", { count: reachableCount })}
            {trunks.some((tr) => tr.trunkType === "auth") &&
              ` · ${registeredCount} ${t("trunks.statusRegistered").toLowerCase()}`}
          </Text>
        )}
      </HStack>
      <HStack gap="12" align="center" className={cls.toolbarActions}>
        <TableToolbar
          actions={
            selection.selectedCount > 0 &&
            canRegister && (
              <Tooltip content={registrationActionTooltip}>
                <span
                  className={cls.actionTooltipTarget}
                  tabIndex={registrationDisabled ? 0 : undefined}
                  aria-label={
                    registrationDisabled ? registrationActionTooltip : undefined
                  }
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={tableStyles.toolButton}
                    aria-label={registrationActionLabel}
                    aria-busy={registrationPending}
                    disabled={registrationDisabled}
                    onClick={() =>
                      void requestSelectedRegistration(selectedTrunks)
                    }
                  >
                    {registrationPending ? (
                      <Loader2
                        aria-hidden="true"
                        size={16}
                        className={cls.spinner}
                      />
                    ) : (
                      <RefreshCw aria-hidden="true" size={16} />
                    )}
                  </Button>
                </span>
              </Tooltip>
            )
          }
          selectedItem={
            selectedTrunks.length === 1 ? selectedTrunks[0] : undefined
          }
          onCopySelected={(trunk) =>
            dispatch(trunksPageActions.openCopyModal(trunk))
          }
          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          tableRef={selection.tableRef}
          searchId="trunks-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: trunks as ITrunkListItem[],
            columns: columns,
            getRowId: (row) => row.id,
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "trunks_export",
          }}
          selection={selection}

        />
      </HStack>
    </Flex>
  );

  if (isError)
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
                {t("common.noData")}
              </Text>
            ) : (
              filtered.map((trunk, index) => {
                return (
                  <TableCard
                    onActivate={() =>
                      dispatch(trunksPageActions.openEditModal(trunk))
                    }
                    selection={{
                      checked: !!selection.rowSelection[trunk.id],
                      label: t("common.tableSelectRow", { number: index + 1 }),
                      onCheckedChange: (checked) =>
                        selection.onRowSelectionChange({
                          ...selection.rowSelection,
                          [trunk.id]: checked,
                        }),
                    }}
                    key={trunk.id}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid="trunks-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <HStack gap="8" align="center">
                          <Text className={cls.name}>{trunk.name}</Text>
                          <TrunkStatus {...trunk} />
                        </HStack>
                      </VStack>
                      <TableRowActions>
                        {canRegister && selection.selectedCount === 0 && (
                          <TrunkRegistrationAction
                            trunk={trunk}
                            pending={pendingIds.has(trunk.id)}
                            onRegister={requestRegistration}
                          />
                        )}
                      </TableRowActions>
                    </HStack>
                    <TableCardDetails
                      fields={[
                        {
                          id: "host",
                          label: t("trunks.host"),
                          value: trunk.host || "—",
                        },
                        {
                          id: "context",
                          label: t("trunks.context"),
                          value: trunk.context || "—",
                        },
                      ]}
                    />
                  </TableCard>
                );
              })
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
          data-testid="trunks-table-scroll"
        >
          <Table
            onRowClick={(trunk) =>
              dispatch(trunksPageActions.openEditModal(trunk))
            }
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={trunks as ITrunkListItem[]}
            columns={columns}
            getRowId={(row) => row.id}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("common.noData")}
            exportFilename="trunks_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

TrunksTable.displayName = "TrunksTable";
