import { EndpointStatus, endpointCallerName } from "@/entities/endpoint";
import type { IEndpointListItem } from "@/shared/api/endpoints/endpointApi";
import {
  useBulkDeleteEndpointsMutation,
  useDeleteEndpointMutation,
  useGetActiveBulkJobQuery,
  useGetBulkJobStatusQuery,
  useGetEndpointsQuery,
} from "@/shared/api/endpoints/endpointApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Checkbox, Label, Table, TableCard, TableCardDetails, TableRowAction, TableRowActions, TableToolbar, Text, Tooltip, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Key, Loader2 } from "lucide-react";
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  apiErrorMessage,
  jobProgress as progressPercent,
} from "../../lib/formValidation";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import cls from "./EndpointsTable.module.scss";
import { useEndpointsTableColumns } from "./useEndpointsTableColumns";

const PAGE_SIZE = 50;

export const EndpointsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const {
    data: endpoints = [],
    isLoading,
    isError,
    refetch,
  } = useGetEndpointsQuery();
  const [bulkDelete, { isLoading: isDeleting }] =
    useBulkDeleteEndpointsMutation();
  const [deleteEndpoint] = useDeleteEndpointMutation();

  const [globalFilter, setGlobalFilter] = React.useState("");
  const selection = useCrossPageRowSelection({ globalFilter });
  const [deleteTarget, setDeleteTarget] =
    React.useState<IEndpointListItem | null>(null);
  const [deleteError, setDeleteError] = React.useState("");
  const [singleDeleting, setSingleDeleting] = React.useState(false);
  const columns = useEndpointsTableColumns(setDeleteTarget);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const ep = endpoints.find((e) => e.id === id);
        return ep?.extension || id;
      }),
    [selection.selectedIds, endpoints],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selection.selectedIds.length === 0 || isDeleting) return;
    setDeleteError("");
    try {
      await bulkDelete(selection.selectedIds).unwrap();
      selection.afterBulkDelete();
    } catch (failure: unknown) {
      setDeleteError(apiErrorMessage(failure, t("endpoints.deleteError")));
    }
  }, [selection, bulkDelete, isDeleting, t]);

  const { data: activeJobData } = useGetActiveBulkJobQuery(undefined, {
    pollingInterval: 3000,
  });
  const activeJobId = activeJobData?.jobId || null;
  const { data: jobStatus } = useGetBulkJobStatusQuery(activeJobId || "", {
    skip: !activeJobId,
    pollingInterval: 1000,
  });
  const isJobActive =
    jobStatus &&
    (jobStatus.status === "pending" || jobStatus.status === "processing");

  const onlineCount = endpoints.filter((e) => e.status === "online").length;

  const filteredForMobile = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((ep) => {
      const ext = (ep.extension || "").toLowerCase();
      const caller = (ep.callerid || "").toLowerCase();
      const dept = (ep.department || "").toLowerCase();
      const ctx = (ep.context || "").toLowerCase();
      return (
        ext.includes(q) ||
        caller.includes(q) ||
        dept.includes(q) ||
        ctx.includes(q)
      );
    });
  }, [endpoints, globalFilter]);

  const confirmSingleDelete = async () => {
    if (!deleteTarget || singleDeleting) return;
    setSingleDeleting(true);
    setDeleteError("");
    try {
      await deleteEndpoint(deleteTarget.id).unwrap();
      const next = { ...selection.rowSelection };
      delete next[deleteTarget.id];
      selection.onRowSelectionChange(next);
      setDeleteTarget(null);
    } catch (failure: unknown) {
      setDeleteError(apiErrorMessage(failure, t("endpoints.deleteError")));
    } finally {
      setSingleDeleting(false);
    }
  };

  const jobProgress =
    isJobActive && jobStatus ? (
      <HStack gap="12" align="center" className={cls.jobBar} max>
        <Loader2 size={16} className={cls.spinner} />
        <Flex className={cls.jobTrack}>
          <Flex
            className={cls.jobFill}
            style={{
              width: `${progressPercent(jobStatus.processed, jobStatus.total)}%`,
            }}
          >
            {""}
          </Flex>
        </Flex>
        <Text variant="muted" className={cls.jobLabel}>
          {t("endpoints.bulkProgress", {
            processed: jobStatus.processed,
            total: jobStatus.total,
          })}
        </Text>
      </HStack>
    ) : null;



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      error={deleteError}
      i18nNs="endpoints"
    />
  );

  const exportLabel =
    selection.selectedCount > 0
      ? t("endpoints.exportSelectedCsv", { count: selection.selectedCount })
      : t("endpoints.exportCsv");
  const deleteLabel = t("endpoints.deleteSelected", {
    count: selection.selectedCount,
  });
  const toolbar = (
    <Flex align="stretch" className={cls.toolbar} max>
      <HStack gap="12" align="center" className={cls.toolbarSummary}>
        <VStack gap="4" align="start">
          <Text className={cls.count}>
            {t("endpoints.totalCount", { count: endpoints.length })}
          </Text>
          <HStack gap="8" align="center" className={cls.summaryStats}>
            <Text as="span" className={cls.onlineBadge}>
              {onlineCount} {t("endpoints.statusOnline").toLowerCase()}
            </Text>
          </HStack>
        </VStack>
      </HStack>
      <TableToolbar
        tableRef={selection.tableRef}
        className={cls.toolbarActions}
        searchId="endpoints-search"
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
        exportTable={{
          data: endpoints,
          columns,
          getRowId: (row) => row.id,
          globalFilter,
          rowSelection: selection.rowSelection,
          filename: "krasterisk_endpoints_export",
        }}
        exportLabel={exportLabel}
        exportDisabled={isLoading || !endpoints.length}
        selection={selection}
        selectAllLabel={t("endpoints.selectionAll")}
        clearSelectionLabel={t("endpoints.selectionClear")}
        selectionRowIds={isMobile ? filteredForMobile.map((ep) => ep.id) : undefined}
        onDeleteSelected={() => {
          setDeleteError("");
          selection.openBulkDelete();
        }}
        deleteDisabled={isDeleting}
        deleteLabel={deleteLabel}
      />
    </Flex>
  );

  if (isError)
    return (
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardContent className={cls.stateContent}>
          <QueryErrorState
            message={t("endpoints.loadError")}
            onRetry={() => void refetch()}
            retryLabel={t("common.retry")}
          />
        </CardContent>
      </Card>
    );

  if (isLoading) {
    return (
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardHeader className={cls.cardHeader}>{toolbar}</CardHeader>
        <CardContent className={cls.stateContent}>
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
        className={cls.card}
        data-testid="hybrid-table"
        data-hybrid="mobile-card"
      >
        <CardHeader className={cls.cardHeader}>
          {toolbar}
          {jobProgress}
        </CardHeader>
        <CardContent className={cls.mobileBody}>
          <VStack gap="8" max className={cls.mobileList}>
            {filteredForMobile.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t("common.noData")}
              </Text>
            ) : (
              filteredForMobile.map((ep) => (
                <TableCard
                  onActivate={() =>
                    dispatch(endpointsPageActions.openEditModal(ep))
                  }
                  aria-label={t("endpoints.editRowAria", { ext: ep.extension })}
                  key={ep.id}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-selected={!!selection.rowSelection[ep.id]}
                  data-testid="endpoints-mobile-card"
                >
                  <HStack
                    gap="12"
                    align="start"
                    className={cls.mobileContent}
                    max
                  >
                    <Label
                      className={cls.selectionControl}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        aria-label={t("endpoints.selectRowAria", {
                          ext: ep.extension,
                        })}
                        checked={!!selection.rowSelection[ep.id]}
                        onChange={(event) =>
                          selection.onRowSelectionChange({
                            ...selection.rowSelection,
                            [ep.id]: event.target.checked,
                          })
                        }
                      />
                    </Label>
                    <VStack
                      gap="8"
                      align="stretch"
                      className={cls.mobileIdentity}
                      max
                    >
                      <HStack gap="8" align="center" wrap="wrap">
                        <Text as="span" className={cls.mobileExtension}>
                          {ep.extension}
                        </Text>
                        {endpointCallerName(ep.callerid) !== ep.extension && (
                          <Text className={cls.callerName}>
                            {endpointCallerName(ep.callerid)}
                          </Text>
                        )}
                      </HStack>
                    </VStack>
                    <TableRowActions className={cls.cardControl}>
                      <Tooltip content={t("endpoints.btnSip")}>
                        <TableRowAction
                          aria-label={t("endpoints.btnSip")}
                          onClick={(event) => {
                            event.stopPropagation();
                            dispatch(
                              endpointsPageActions.openCredentialsModal(ep.id),
                            );
                          }}
                        >
                          <Key />
                        </TableRowAction>
                      </Tooltip>
                    </TableRowActions>
                  </HStack>
                  <TableCardDetails
                    fields={[
                      {
                        id: "status",
                        label: t("endpoints.status"),
                        value: <EndpointStatus endpoint={ep} />,
                      },
                      {
                        id: "context",
                        label: t("endpoints.context"),
                        value: ep.context,
                      },
                      ...(ep.department
                        ? [
                            {
                              id: "department",
                              label: t("endpoints.department"),
                              value: ep.department,
                            },
                          ]
                        : []),
                    ]}
                  />
                  {(ep.clientIp || ep.userAgent) && (
                    <TableCardDetails
                      fields={[
                        {
                          id: "network",
                          label: t("endpoints.network"),
                          value: [ep.clientIp, ep.userAgent]
                            .filter(Boolean)
                            .join(" · "),
                        },
                      ]}
                    />
                  )}
                </TableCard>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
        <BulkDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) =>
            !open && !singleDeleting && setDeleteTarget(null)
          }
          labels={deleteTarget ? [deleteTarget.extension] : []}
          allMatching={false}
          hasFilter={false}
          isDeleting={singleDeleting}
          onConfirm={confirmSingleDelete}
          error={deleteError}
          i18nNs="endpoints"
        />
      </Card>
    );
  }

  return (
    <Card
      className={[tableStyles.surface, cls.card].join(" ")}
      data-testid="hybrid-table"
      data-hybrid="overflow-x-auto"
    >
      <CardHeader className={cls.cardHeader}>
        {toolbar}
        {jobProgress}
      </CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="endpoints-table-scroll"
        >
          <Table
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            data={endpoints}
            columns={columns}
            getRowId={(row) => row.id}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("common.noData")}
            exportFilename="krasterisk_endpoints_export"
            selectAllAriaLabel={t("endpoints.selectPageAria")}
            selectRowAriaLabel={(row) =>
              t("endpoints.selectRowAria", { ext: row.extension })
            }
            onRowClick={(endpoint) =>
              dispatch(endpointsPageActions.openEditModal(endpoint))
            }
            getRowAriaLabel={(endpoint) =>
              t("endpoints.editRowAria", { ext: endpoint.extension })
            }

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
      <BulkDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !singleDeleting && setDeleteTarget(null)
        }
        labels={deleteTarget ? [deleteTarget.extension] : []}
        allMatching={false}
        hasFilter={false}
        isDeleting={singleDeleting}
        onConfirm={confirmSingleDelete}
        error={deleteError}
        i18nNs="endpoints"
      />
    </Card>
  );
});

EndpointsTable.displayName = "EndpointsTable";
