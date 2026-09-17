import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
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
import { useGetMohClassesQuery, useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { mohActions } from '../../model/slice/mohSlice';
import { useMohTableColumns } from './useMohTableColumns';
import cls from './MohTable.module.scss';

export const MohTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: mohClasses = [], isLoading } = useGetMohClassesQuery();
  const [deleteMoh] = useDeleteMohClassMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const columns = useMohTableColumns();
  const selectedCount = Object.keys(rowSelection).length;

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return mohClasses;
    return mohClasses.filter((moh) => {
      const name = (moh.displayName || '').toLowerCase();
      const sort = (moh.sort || '').toLowerCase();
      return name.includes(q) || sort.includes(q);
    });
  }, [mohClasses, globalFilter]);

  const handleBulkDelete = useCallback(async () => {
    const names = Object.keys(rowSelection);
    if (!names.length) return;
    if (!window.confirm(t('moh.confirmBulkDelete'))) return;
    setIsDeleting(true);
    try {
      await Promise.all(names.map((name) => deleteMoh(name).unwrap()));
      setRowSelection({});
    } finally {
      setIsDeleting(false);
    }
  }, [rowSelection, deleteMoh, t]);

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Music size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('moh.count', { count: mohClasses.length })}</Text>
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
            {t('moh.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="moh-search"
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
                {t('moh.empty.title')}
              </Text>
            ) : (
              filtered.map((moh) => (
                <Flex
                  key={moh.name}
                  direction="column"
                  className={cls.mobileCard}
                  data-testid="moh-mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <HStack gap="8" align="center">
                        <Music size={16} className={cls.musicIcon} />
                        <Text as="span" className={cls.name}>{moh.displayName}</Text>
                      </HStack>
                      <Text as="span" className={cls.tracksBadge}>
                        {moh.entries?.length || 0}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(mohActions.openEditModal(moh))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          const confirmed = window.confirm(
                            t('moh.confirmDelete').replace('{{name}}', moh.displayName),
                          );
                          if (confirmed) {
                            deleteMoh(moh.name);
                          }
                        }}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
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
          data-testid="moh-table-scroll"
        >
          <DataTable
            className={cls.table}
            data={mohClasses}
            columns={columns}
            getRowId={(row) => row.name}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('moh.empty.title')}
            exportFilename="moh_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

MohTable.displayName = 'MohTable';
