import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Loader2, Pencil, Search, Trash2, Video } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteConferenceRoomMutation,
  useGetConferenceRoomsQuery,
} from '@/shared/api/endpoints/conferenceRoomApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { conferencesPageActions } from '../../model/slice/conferencesPageSlice';
import {
  formatRoomKind,
  formatRoomRecordMode,
  formatRoomStrictness,
  useConferencesTableColumns,
} from './useConferencesTableColumns';
import type { ConferenceListRow } from './conferenceListRow';
import cls from './ConferencesTable.module.scss';

export const ConferencesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data, isLoading, isError, refetch } = useGetConferenceRoomsQuery();
  const rooms = (data ?? []) as ConferenceListRow[];
  const [deleteRoom] = useDeleteConferenceRoomMutation();
  const [pendingDelete, setPendingDelete] = useState<ConferenceListRow | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedCount = Object.keys(rowSelection).length;

  const onDelete = useCallback((row: ConferenceListRow) => {
    setPendingDelete(row);
  }, []);
  const columns = useConferencesTableColumns(onDelete);

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => {
      const name = (room.name || '').toLowerCase();
      const number = String(room.number ?? '').toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }, [rooms, globalFilter]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('conferences.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteRoom(id).unwrap()));
      setRowSelection({});
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, deleteRoom, t]);

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Video size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('conferences.count', { count: rooms.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={() => void handleBulkDelete()}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('conferences.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="conferences-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  const deleteDialog = (
    <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('conferences.confirmDelete', { name: pendingDelete?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('conferences.confirmDeleteBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingDelete(null)}>
            {t('conferences.confirmDeleteKeep')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!pendingDelete) return;
              void deleteRoom(pendingDelete.uid);
              setPendingDelete(null);
            }}
          >
            {t('conferences.confirmDeleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  if (isError) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="12" align="center" className={cls.error}>
            <Text>{t('conferences.loadFailed')}</Text>
            <Button onClick={() => void refetch()}>{t('conferences.retryLoad')}</Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (rooms.length === 0) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid={isMobile ? 'mobile-card' : 'overflow-x-auto'}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="12" align="center" className={cls.empty}>
            <Text>{t('conferences.noRooms')}</Text>
            <Text variant="muted">{t('conferences.noRoomsHint')}</Text>
            <Button onClick={() => dispatch(conferencesPageActions.openCreateModal())}>
              {t('conferences.addRoom')}
            </Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <>
        <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
          <CardHeader>{toolbar}</CardHeader>
          <CardContent>
            <VStack gap="8" max className={cls.mobileList}>
              {filtered.length === 0 ? (
                <Text variant="muted" className={cls.mobileEmpty}>
                  {t('conferences.noRooms')}
                </Text>
              ) : filtered.map((room) => (
                <Flex
                  key={room.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="conferences-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name} title={room.name}>
                        {room.name}
                      </Text>
                      <Text as="span" className={cls.muted}>
                        {room.number}
                        {' · '}
                        {formatRoomKind(room.kind, t)}
                        {' · '}
                        {formatRoomRecordMode(room.record_mode, t)}
                      </Text>
                      <HStack gap="8" wrap="wrap">
                        <Badge variant="secondary">{formatRoomStrictness(room.entry_strictness, t)}</Badge>
                        <Text as="span" className={cls.headcount}>
                          {room.participants?.length ?? 0}
                        </Text>
                      </HStack>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(conferencesPageActions.openEditModal(room.uid))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        title={t('common.copy')}
                        aria-label={t('common.copy')}
                        onClick={() => dispatch(conferencesPageActions.openCopyModal(room.uid))}
                      >
                        <Copy />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => onDelete(room)}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
                  </HStack>
                </Flex>
              ))}
            </VStack>
          </CardContent>
        </Card>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          <Flex
            direction="column"
            align="stretch"
            className={cls.tableScroll}
            data-testid="conferences-table-scroll"
          >
            <DataTable
              className={cls.table}
              data={rooms}
              columns={columns}
              getRowId={(row) => String(row.uid)}
              selectable
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              globalFilter={globalFilter}
              pageSize={50}
              emptyText={t('conferences.noRooms')}
              exportFilename="conferences_export"
            />
          </Flex>
        </CardContent>
      </Card>
      {deleteDialog}
    </>
  );
});

ConferencesTable.displayName = 'ConferencesTable';
