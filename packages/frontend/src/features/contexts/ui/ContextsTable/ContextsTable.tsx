import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Search, Loader2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable, Text } from '@/shared/ui';
import { Flex, HStack } from '@/shared/ui/Stack';
import { useGetContextsQuery, useBulkDeleteContextsMutation } from '@/shared/api/api';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useContextsTableColumns } from './useContextsTableColumns';
import cls from './ContextsTable.module.scss';

export const ContextsTable = memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const { data: contexts = [], isLoading } = useGetContextsQuery();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteContextsMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useContextsTableColumns();

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;

    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Network size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('contexts.count', { count: contexts.length, defaultValue: `Всего: ${contexts.length}` })}
        </Text>
      </HStack>
      <HStack gap="12" align="center" className={cls.toolbarActions}>
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
            {t('common.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="contexts-search"
            placeholder={t('common.search', 'Поиск...')}
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

  return (
    <Card className={cls.card} data-testid="contexts-table">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex direction="column" align="stretch" className={cls.tableScroll}>
          <DataTable
            className={cls.table}
            data={contexts}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="contexts_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

ContextsTable.displayName = 'ContextsTable';
