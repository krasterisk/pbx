import { TableCard } from "@/shared/ui";

import {
  useDeleteConferenceRoomMutation,
  useGetConferenceRoomsQuery,
} from "@/shared/api/endpoints/conferenceRoomApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { Badge, BulkDeleteDialog, Button, Card, CardContent, CardHeader, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Loader2, Video } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { conferencesPageActions } from "../../model/slice/conferencesPageSlice";
import type { ConferenceListRow } from "./conferenceListRow";
import cls from "./ConferencesTable.module.scss";
import {
  formatRoomKind,
  formatRoomRecordMode,
  formatRoomStrictness,
  useConferencesTableColumns,
} from "./useConferencesTableColumns";

const PAGE_SIZE = 50;

export const ConferencesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data, isLoading, isError, refetch } = useGetConferenceRoomsQuery();
  const rooms = useMemo(() => (data ?? []) as ConferenceListRow[], [data]);
  const [deleteRoom] = useDeleteConferenceRoomMutation();
  const [pendingDelete, setPendingDelete] = useState<ConferenceListRow | null>(
    null,
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const selection = useCrossPageRowSelection({ globalFilter });

  const onDelete = useCallback((row: ConferenceListRow) => {
    setPendingDelete(row);
  }, []);
  const columns = useConferencesTableColumns(onDelete);

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => {
      const name = (room.name || "").toLowerCase();
      const number = String(room.number ?? "").toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }, [rooms, globalFilter]);

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = rooms.find((room) => String(room.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, rooms],
  );

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteRoom(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteRoom]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="conferences"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Video size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("conferences.count", { count: rooms.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="conferences-search"
          searchPlaceholder={t("common.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: rooms,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "conferences_export",
          }}
          selection={selection}
          onCopySelected={(item) =>
            dispatch(conferencesPageActions.openCopyModal(item.uid))
          }

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("conferences.deleteSelected", {
            count: selection.selectedCount,
          })}
        />
      </HStack>
    </Flex>
  );

  const deleteDialog = (
    <Dialog
      open={Boolean(pendingDelete)}
      onOpenChange={(open) => !open && setPendingDelete(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("conferences.confirmDelete", {
              name: pendingDelete?.name ?? "",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("conferences.confirmDeleteBody")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingDelete(null)}>
            {t("conferences.confirmDeleteKeep")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!pendingDelete) return;
              void deleteRoom(pendingDelete.uid);
              setPendingDelete(null);
            }}
          >
            {t("conferences.confirmDeleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  if (isError) {
    return (
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
        <CardContent>
          <QueryErrorState
            message={t("conferences.loadFailed")}
            onRetry={() => void refetch()}
            retryLabel={t("conferences.retryLoad")}
          />
        </CardContent>
      </Card>
    );
  }

  if (rooms.length === 0) {
    return (
      <Card
        className={[tableStyles.surface, cls.card].join(" ")}
        data-testid="hybrid-table"
        data-hybrid={isMobile ? "mobile-card" : "overflow-x-auto"}
      >
        <CardHeader className={tableStyles.toolbarPanel}>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="12" align="center" className={cls.empty}>
            <Text>{t("conferences.noRooms")}</Text>
            <Text variant="muted">{t("conferences.noRoomsHint")}</Text>
            <Button
              onClick={() => dispatch(conferencesPageActions.openCreateModal())}
            >
              {t("conferences.addRoom")}
            </Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <>
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
                  {t("conferences.noRooms")}
                </Text>
              ) : (
                filtered.map((room) => (
                  <TableCard
                    onActivate={() =>
                      dispatch(conferencesPageActions.openEditModal(room.uid))
                    }
                    key={room.uid}
                    direction="column"
                    className={[tableStyles.card, cls.mobileCard].join(" ")}
                    data-testid="conferences-mobile-card"
                    selection={selection.cardSelection(
                      String(room.uid),
                      t("common.selectRowAria", { index: String(room.uid) }),
                    )}
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <Text as="span" className={cls.name} title={room.name}>
                          {room.name}
                        </Text>
                        <Text as="span" className={cls.muted}>
                          {room.number}
                          {" · "}
                          {formatRoomKind(room.kind, t)}
                          {" · "}
                          {formatRoomRecordMode(room.record_mode, t)}
                        </Text>
                        <HStack gap="8" wrap="wrap">
                          <Badge variant="secondary">
                            {formatRoomStrictness(room.entry_strictness, t)}
                          </Badge>
                          <Text as="span" className={cls.headcount}>
                            {room.participants?.length ?? 0}
                          </Text>
                        </HStack>
                      </VStack>
                    </HStack>
                  </TableCard>
                ))
              )}
            </VStack>
          </CardContent>
        </Card>
        {deleteDialog}
        {bulkDeleteDialog}
      </>
    );
  }

  return (
    <>
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
            data-testid="conferences-table-scroll"
          >
            <Table
              onRowClick={(room) =>
                dispatch(conferencesPageActions.openEditModal(room.uid))
              }
              surface={false}
              showSearch={false}
              showExport={false}
              ref={selection.tableRef}
              className={cls.table}
              data={rooms}
              columns={columns}
              getRowId={(row) => String(row.uid)}
              selectable
              rowSelection={selection.rowSelection}
              onRowSelectionChange={selection.onRowSelectionChange}
              globalFilter={globalFilter}
              pageSize={PAGE_SIZE}
              emptyText={t("conferences.noRooms")}
              exportFilename="conferences_export"
              selectAllAriaLabel={t("common.selectPageAria")}

            />
          </Flex>
        </CardContent>
      </Card>
      {deleteDialog}
      {bulkDeleteDialog}
    </>
  );
});

ConferencesTable.displayName = "ConferencesTable";
