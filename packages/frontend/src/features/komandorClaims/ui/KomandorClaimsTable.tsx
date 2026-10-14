import type { IKomandorClaim } from "@/entities/komandorClaim";
import { KOMANDOR_STATUS_OPTIONS } from "@/entities/komandorClaim";
import {
  useDeleteKomandorClaimMutation,
  useGetKomandorClaimsQuery,
} from "@/shared/api/endpoints/komandorClaimApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { Badge, BulkDeleteDialog, Button, Table, Text } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { HStack } from "@/shared/ui/Stack";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { KomandorClaimModal } from "./KomandorClaimModal";
import type { KomandorClaimFilters } from "./KomandorClaimsFilter";
import cls from "./KomandorClaimsTable.module.scss";

interface Props {
  filters: KomandorClaimFilters;
}

const STATUS_BADGE: Record<
  string,
  "default" | "outline" | "secondary" | "destructive"
> = {
  new: "outline",
  in_progress: "secondary",
  completed: "default",
  postponed: "secondary",
  impossible: "destructive",
};

const PAGE_SIZE = 50;

export function KomandorClaimsTable({ filters }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const query = {
    search: filters.search,
    status: filters.status,
    topic: filters.topic,
    store: filters.store,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: PAGE_SIZE,
  };
  const {
    data,
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetKomandorClaimsQuery(query);
  const [remove] = useDeleteKomandorClaimMutation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<IKomandorClaim | undefined>();
  const selectionFilterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const selection = useCrossPageRowSelection({
    globalFilter: selectionFilterKey,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const labelCacheRef = useRef(new Map<string, string>());

  const handleDelete = useCallback(
    async (uid: number) => {
      if (!window.confirm(t("common.confirmDelete"))) return;
      try {
        await remove(uid).unwrap();
        toast.success(t("common.deleted", "Удалено"));
      } catch {
        toast.error(t("common.error"));
      }
    },
    [remove, t],
  );

  const rows = useMemo(() => data?.rows || [], [data?.rows]);

  const hasFilter = Boolean(
    filters.search?.trim() ||
    filters.status ||
    filters.topic ||
    filters.store ||
    filters.dateFrom ||
    filters.dateTo,
  );

  const selectedLabels = useMemo(() => {
    for (const row of rows) {
      labelCacheRef.current.set(
        String(row.uid),
        row.request_number || row.store_name || String(row.uid),
      );
    }
    return selection.selectedIds.map(
      (id) => labelCacheRef.current.get(id) || id,
    );
  }, [selection.selectedIds, rows]);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => remove(id).unwrap()));
      selection.afterBulkDelete();
      toast.success(t("common.deleted", "Удалено"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsDeleting(false);
    }
  }, [selection, remove, t]);



  const columns = useMemo<ColumnDef<IKomandorClaim>[]>(
    () => [
      {
        header: "№",
        accessorFn: (row) => row.request_number || `#${row.uid}`,
      },
      {
        header: "Дата",
        accessorFn: (row) =>
          new Date(row.request_date).toLocaleDateString("ru-RU"),
      },
      {
        header: "Магазин",
        accessorFn: (row) =>
          [row.store_code, row.store_name].filter(Boolean).join(" "),
      },
      { header: "Канал", accessorKey: "channel" },
      { header: "Тематика", accessorKey: "topic" },
      { header: "Подтема", accessorKey: "subtopic" },
      {
        header: "Статус",
        cell: ({ row }) => {
          const opt = KOMANDOR_STATUS_OPTIONS.find(
            (o) => o.value === row.original.request_status,
          );
          return (
            <Badge
              variant={STATUS_BADGE[row.original.request_status] || "outline"}
            >
              {opt?.label || row.original.request_status}
            </Badge>
          );
        },
      },
    ],
    [handleDelete, t],
  );

  if (isListLoadError)
    return (
      <QueryErrorState
        message={t("common.queryLoadError")}
        onRetry={() => void retryListLoad()}
      />
    );
  return (
    <div>
      <HStack justify="end" gap="8" align="center" className={cls.toolbar}>
        <HStack gap="8" align="center" className={cls.toolbarActions}>
          <Button
            size="sm"
            onClick={() => {
              setCurrent(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            <Text as="span">{t("common.create", "Создать")}</Text>
          </Button>
        </HStack>
      </HStack>
      <Table
        onRowClick={(row) => {
          setCurrent(row);
          setOpen(true);
        }}
        showSearch={false}
        toolbar={{
          selection,
          onDeleteSelected: selection.openBulkDelete,
          deleteDisabled: isDeleting,
        }}
        ref={selection.tableRef}
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.uid)}
        selectable
        rowSelection={selection.rowSelection}
        onRowSelectionChange={selection.onRowSelectionChange}
        pageSize={PAGE_SIZE}
        emptyText={
          isLoading ? t("common.loading", "Загрузка...") : t("common.noData")
        }
        selectAllAriaLabel={t("common.selectPageAria")}

      />
      <BulkDeleteDialog
        open={selection.bulkDeleteOpen}
        onOpenChange={selection.setBulkDeleteOpen}
        labels={selectedLabels}
        allMatching={selection.allMatchingSelected}
        hasFilter={hasFilter}
        isDeleting={isDeleting}
        onConfirm={handleConfirmBulkDelete}
      />
      <KomandorClaimModal
        isOpen={open}
        onClose={() => setOpen(false)}
        record={current}
      />
    </div>
  );
}
