import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Table } from '@tanstack/react-table';
import { Bot, Copy, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  DataTable,
  Input,
  TableRowAction,
  TableRowActions,
  TableSelectionBanner,
  BulkDeleteDialog,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import type { IVoiceRobot } from '@/entities/voiceRobot';
import { useDeleteVoiceRobotMutation, useGetVoiceRobotsQuery } from '@/shared/api/endpoints/voiceRobotsApi';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useCrossPageRowSelection } from '@/shared/hooks/useCrossPageRowSelection';
import { useVoiceRobotsTableColumns } from './useVoiceRobotsTableColumns';
import cls from './VoiceRobotsTable.module.scss';

const PAGE_SIZE = 50;

export const VoiceRobotsTable = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const { data: robots = [], isLoading } = useGetVoiceRobotsQuery();
  const [deleteRobot] = useDeleteVoiceRobotMutation();
  const [globalFilter, setGlobalFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const selection = useCrossPageRowSelection({ globalFilter });

  const handleEdit = useCallback((robot: IVoiceRobot) => {
    navigate(`/voice-robots/${robot.uid}`);
  }, [navigate]);

  const handleCopy = useCallback((robot: IVoiceRobot) => {
    navigate('/voice-robots/create', {
      state: {
        copyFrom: {
          ...robot,
          uid: undefined,
          name: `${robot.name} (${t('common.copy')})`,
        },
      },
    });
  }, [navigate, t]);

  const handleDelete = useCallback((robot: IVoiceRobot) => {
    if (window.confirm(t('voiceRobots.confirmDelete', { name: robot.name }))) {
      deleteRobot(robot.uid);
    }
  }, [deleteRobot, t]);

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
    return robots.filter((robot) => (robot.name || '').toLowerCase().includes(q));
  }, [robots, globalFilter]);

  const renderRowActions = (robot: IVoiceRobot) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => handleEdit(robot)}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        title={t('common.copy')}
        aria-label={t('common.copy')}
        onClick={() => handleCopy(robot)}
      >
        <Copy />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => handleDelete(robot)}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

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

  const renderSelectionBanner = useCallback(
    (table: Table<(typeof robots)[number]>) => (
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
      i18nNs="voiceRobots"
    />
  );

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Bot size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('voiceRobots.count', { count: robots.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selection.selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selection.selectedCount === 0}
            aria-hidden={selection.selectedCount === 0}
            tabIndex={selection.selectedCount === 0 ? -1 : undefined}
            onClick={selection.openBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('voiceRobots.deleteSelected', { count: selection.selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="voice-robots-search"
            placeholder={t('voiceRobots.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
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
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {filtered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t('voiceRobots.empty')}
              </Text>
            ) : (
              filtered.map((robot) => (
                <Flex
                  key={robot.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="voice-robots-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{robot.name}</Text>
                      <Text as="span" className={robot.active ? cls.statusOn : cls.statusOff}>
                        {robot.active ? t('common.active') : t('common.inactive')}
                      </Text>
                    </VStack>
                    {renderRowActions(robot)}
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
        {bulkDeleteDialog}
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="voice-robots-table-scroll"
        >
          <DataTable
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
            emptyText={t('voiceRobots.empty')}
            exportFilename="voice_robots_export"
            selectAllAriaLabel={t('common.selectPageAria')}
            renderBanner={renderSelectionBanner}
          />
        </Flex>
      </CardContent>
      {bulkDeleteDialog}
    </Card>
  );
});

VoiceRobotsTable.displayName = 'VoiceRobotsTable';
