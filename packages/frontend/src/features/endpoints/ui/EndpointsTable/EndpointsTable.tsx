import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type Table } from "@tanstack/react-table";
import {
  Phone,
  Search,
  Loader2,
  Trash2,
  Download,
  Pencil,
  Key,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Checkbox,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
  TableSelectionBanner,
  BulkDeleteDialog,
} from "@/shared/ui";
import { HStack, Flex, VStack } from "@/shared/ui/Stack";
import {
  useGetEndpointsQuery,
  useBulkDeleteEndpointsMutation,
  useGetActiveBulkJobQuery,
  useGetBulkJobStatusQuery,
  useDeleteEndpointMutation,
} from "@/shared/api/endpoints/endpointApi";
import type { IEndpointListItem } from "@/shared/api/endpoints/endpointApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import { useEndpointsTableColumns } from "./useEndpointsTableColumns";
import cls from "./EndpointsTable.module.scss";
import { EndpointStatus, endpointCallerName } from "@/entities/endpoint";
import {
  apiErrorMessage,
  jobProgress as progressPercent,
} from "../../lib/formValidation";
import { buildCsv, downloadCsv } from "@/shared/lib/csv";

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

  const handleExportCsv = () => {
    if (!isMobile) {
      selection.tableRef.current?.exportCsv(
        selection.selectedCount ? { rows: "selected" } : undefined,
      );
      return;
    }
    const selected = endpoints.filter(
      (endpoint) => selection.rowSelection[endpoint.id],
    );
    const rows = selected.length ? selected : filteredForMobile;
    downloadCsv(
      buildCsv([
        [
          t("endpoints.extension"),
          t("endpoints.callerid"),
          t("endpoints.department"),
          t("endpoints.context"),
          t("endpoints.status"),
          t("endpoints.network"),
        ],
        ...rows.map((endpoint) => [
          endpoint.extension,
          endpointCallerName(endpoint.callerid),
          endpoint.department || "",
          endpoint.context,
          t(
            endpoint.status === "online"
              ? "endpoints.statusOnline"
              : "endpoints.statusOffline",
          ),
          endpoint.userAgent || "",
        ]),
      ]),
      "krasterisk_endpoints_export.csv",
    );
  };
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

  const renderSelectionBanner = useCallback(
    (table: Table<IEndpointListItem>) => (
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
      error={deleteError}
      i18nNs="endpoints"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Phone size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("endpoints.count", { count: endpoints.length })}
        </Text>
        {endpoints.length > 0 && (
          <Text as="span" className={cls.onlineBadge}>
            {onlineCount} {t("endpoints.statusOnline").toLowerCase()}
          </Text>
        )}
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {
          <Button
            variant="destructive"
            className={
              selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined
            }
            disabled={isDeleting || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={() => {
              setDeleteError("");
              selection.openBulkDelete();
            }}
          >
            {isDeleting ? (
              <Loader2 size={16} className={cls.spinner} />
            ) : (
              <Trash2 size={16} />
            )}
            {isDeleting
              ? t("common.loading")
              : t("endpoints.deleteSelected", {
                  count: selection.selectedCount,
                })}
          </Button>
        }
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="endpoints-search"
            aria-label={t("common.search")}
            placeholder={t("common.search")}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
        {
          <Button variant="outline" onClick={handleExportCsv}>
            <Download size={16} />
            {selection.selectedCount > 0
              ? t("endpoints.exportSelectedCsv", {
                  count: selection.selectedCount,
                })
              : t("endpoints.exportCsv")}
          </Button>
        }
      </HStack>
    </Flex>
  );

  if (isError)
    return (
      <Card className={cls.card}>
        <CardContent>
          <QueryErrorState message={t("endpoints.loadError")} onRetry={() => void refetch()} retryLabel={t("common.retry")} />
        </CardContent>
      </Card>
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
        <CardHeader>
          {toolbar}
          {jobProgress}
          <HStack gap="8" wrap="wrap">
            <Button
              type="button"
              variant="link"
              onClick={() =>
                selection.onRowSelectionChange(
                  Object.fromEntries(
                    filteredForMobile.map((endpoint) => [endpoint.id, true]),
                  ),
                )
              }
            >
              {t("endpoints.selectionAll")}
            </Button>
            <Button
              type="button"
              variant="link"
              disabled={!selection.selectedCount}
              onClick={() => selection.onRowSelectionChange({})}
            >
              {t("endpoints.selectionClear")}
            </Button>
          </HStack>
        </CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filteredForMobile.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t("common.noData")}
              </Text>
            ) : (
              filteredForMobile.map((ep) => {
                return (
                  <Flex
                    key={ep.id}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid="endpoints-mobile-card"
                  >
                    <HStack justify="between" align="start" max wrap="wrap">
                      <VStack gap="4">
                        <HStack gap="8" align="center">
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
                          <Text as="span" className={cls.extension}>
                            {ep.extension}
                          </Text>
                          <EndpointStatus endpoint={ep} />
                        </HStack>
                        <Text as="span" className={cls.cell}>
                          {endpointCallerName(ep.callerid)}
                        </Text>
                        {ep.department ? (
                          <Text as="span" className={cls.cellMuted}>
                            {ep.department}
                          </Text>
                        ) : null}
                      </VStack>
                      <TableRowActions>
                        <TableRowAction
                          title={t("endpoints.btnSip")}
                          aria-label={t("endpoints.btnSip")}
                          onClick={() =>
                            dispatch(
                              endpointsPageActions.openCredentialsModal(ep.id),
                            )
                          }
                        >
                          <Key />
                        </TableRowAction>
                        <TableRowAction
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          onClick={() =>
                            dispatch(endpointsPageActions.openEditModal(ep))
                          }
                        >
                          <Pencil />
                        </TableRowAction>
                        <TableRowAction
                          danger
                          title={t("common.delete")}
                          aria-label={t("common.delete")}
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(ep);
                          }}
                        >
                          <Trash2 />
                        </TableRowAction>
                      </TableRowActions>
                    </HStack>
                  </Flex>
                );
              })
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
      className={cls.card}
      data-testid="hybrid-table"
      data-hybrid="overflow-x-auto"
    >
      <CardHeader>
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
          <DataTable
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
            renderBanner={renderSelectionBanner}
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
