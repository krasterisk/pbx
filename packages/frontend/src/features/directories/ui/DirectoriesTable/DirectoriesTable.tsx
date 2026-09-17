import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Copy, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import type { IDirectory } from '@krasterisk/shared';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useDeleteDirectoryMutation, useGetDirectoriesQuery } from '@/shared/api/endpoints/directoryApi';
import { directoriesActions } from '../../model/slice/directoriesSlice';
import { useDirectoriesTableColumns } from './useDirectoriesTableColumns';
import cls from './DirectoriesTable.module.scss';

export const DirectoriesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: directories = [], isLoading } = useGetDirectoriesQuery();
  const [deleteDirectory] = useDeleteDirectoryMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const columns = useDirectoriesTableColumns();
  const selectedCount = Object.keys(rowSelection).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return directories;
    return directories.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [directories, globalFilter]);

  const renderActions = (item: IDirectory) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => dispatch(directoriesActions.openEditModal(item))}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        title={t('common.copy')}
        aria-label={t('common.copy')}
        onClick={() => dispatch(directoriesActions.openCopyModal(item))}
      >
        <Copy />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => {
          if (window.confirm(t('directories.confirmDelete'))) {
            void deleteDirectory(item.uid);
          }
        }}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('directories.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteDirectory(id).unwrap()));
      setRowSelection({});
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, deleteDirectory, t]);

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <BookMarked size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('directories.count', { count: directories.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('directories.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="directories-search"
            placeholder={t('common.search')}
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
                {t('directories.empty')}
              </Text>
            ) : (
              filtered.map((item) => (
                <Flex
                  key={item.uid}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="directories-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text as="span" className={cls.name}>{item.name}</Text>
                      <Text as="span" className={cls.muted}>
                        {item.description || t('directories.noDescription')}
                      </Text>
                    </VStack>
                    {renderActions(item)}
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </CardContent>
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
          data-testid="directories-table-scroll"
        >
          <DataTable
            className={cls.table}
            data={directories}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('directories.empty')}
            exportFilename="directories_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

DirectoriesTable.displayName = 'DirectoriesTable';
