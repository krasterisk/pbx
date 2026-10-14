import { TableCard } from "@/shared/ui";

import type { IVoiceRobot } from "@/entities/voiceRobot";
import {
  useDeleteVoiceRobotMutation,
  useGetVoiceRobotsQuery,
} from "@/shared/api/endpoints/voiceRobotsApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { BulkDeleteDialog, Card, CardContent, CardHeader, Table, TableToolbar, Text, tableStyles } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";

import { Bot, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useVoiceRobotsTableColumns } from "./useVoiceRobotsTableColumns";
import cls from "./VoiceRobotsTable.module.scss";

const PAGE_SIZE = 50;

export const VoiceRobotsTable = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const {
    data: robots = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetVoiceRobotsQuery();
  const [deleteRobot] = useDeleteVoiceRobotMutation();
  const [globalFilter, setGlobalFilter] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const selection = useCrossPageRowSelection({ globalFilter });

  const handleEdit = useCallback(
    (robot: IVoiceRobot) => {
      navigate(`/voice-robots/${robot.uid}`);
    },
    [navigate],
  );

  const handleCopy = useCallback(
    (robot: IVoiceRobot) => {
      navigate("/voice-robots/create", {
        state: {
          copyFrom: {
            ...robot,
            uid: undefined,
            name: `${robot.name} (${t("common.copy")})`,
          },
        },
      });
    },
    [navigate, t],
  );

  const handleDelete = useCallback(
    (robot: IVoiceRobot) => {
      if (
        window.confirm(t("voiceRobots.confirmDelete", { name: robot.name }))
      ) {
        deleteRobot(robot.uid);
      }
    },
    [deleteRobot, t],
  );

  const columns = useVoiceRobotsTableColumns({
    onEdit: handleEdit,
    onCopy: handleCopy,
    onDelete: handleDelete,
  });

  const selectedLabels = useMemo(
    () =>
      selection.selectedIds.map((id) => {
        const row = robots.find((robot) => String(robot.uid) === id);
        return row?.name || id;
      }),
    [selection.selectedIds, robots],
  );

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return robots;
    return robots.filter((robot) =>
      (robot.name || "").toLowerCase().includes(q),
    );
  }, [robots, globalFilter]);

  const renderRowActions = (robot: IVoiceRobot) => null;

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = selection.selectedIds.map(Number);
    if (!ids.length) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteRobot(id).unwrap()));
      selection.afterBulkDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [selection, deleteRobot]);



  const bulkDeleteDialog = (
    <BulkDeleteDialog
      open={selection.bulkDeleteOpen}
      onOpenChange={selection.setBulkDeleteOpen}
      labels={selectedLabels}
      allMatching={selection.allMatchingSelected}
      hasFilter={globalFilter.trim().length > 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmBulkDelete}
      i18nNs="voiceRobots"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Bot size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("voiceRobots.count", { count: robots.length })}
        </Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        <TableToolbar
          tableRef={selection.tableRef}
          searchId="voice-robots-search"
          searchPlaceholder={t("voiceRobots.search")}
          searchValue={globalFilter}
          onSearchChange={(value) => setGlobalFilter(value)}
          exportTable={{
            data: robots,
            columns: columns,
            getRowId: (row) => String(row.uid),
            globalFilter: globalFilter,
            rowSelection: selection.rowSelection,
            filename: "voice_robots_export",
          }}
          selection={selection}
          onCopySelected={(item) => handleCopy(item)}

          onDeleteSelected={selection.openBulkDelete}
          deleteDisabled={isDeleting}
          deleteLabel={t("voiceRobots.deleteSelected", {
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
                {t("voiceRobots.empty")}
              </Text>
            ) : (
              filtered.map((robot) => (
                <TableCard
                  onActivate={() => handleEdit(robot)}
                  key={robot.uid}
                  direction="column"
                  className={[tableStyles.card, cls.mobileCard].join(" ")}
                  data-testid="voice-robots-mobile-card"
                  selection={selection.cardSelection(
                    String(robot.uid),
                    t("common.selectRowAria", { index: String(robot.uid) }),
                  )}
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>
                        {robot.name}
                      </Text>
                      <Text
                        as="span"
                        className={robot.active ? cls.statusOn : cls.statusOff}
                      >
                        {robot.active
                          ? t("common.active")
                          : t("common.inactive")}
                      </Text>
                    </VStack>
                    {renderRowActions(robot)}
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
          data-testid="voice-robots-table-scroll"
        >
          <Table
            onRowClick={handleEdit}
            surface={false}
            showSearch={false}
            showExport={false}
            ref={selection.tableRef}
            className={cls.table}
            columns={columns}
            data={robots}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            globalFilter={globalFilter}
            pageSize={PAGE_SIZE}
            emptyText={t("voiceRobots.empty")}
            exportFilename="voice_robots_export"
            selectAllAriaLabel={t("common.selectPageAria")}

          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

VoiceRobotsTable.displayName = "VoiceRobotsTable";
