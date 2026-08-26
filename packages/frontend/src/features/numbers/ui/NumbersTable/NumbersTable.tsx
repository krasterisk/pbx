import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Hash, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  DataTable,
  Button,
  Text,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import { useGetNumbersQuery, useDeleteNumberMutation, useBulkDeleteNumbersMutation } from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { numbersPageActions } from '../../model/slice/numbersPageSlice';
import styles from './NumbersTable.module.scss';

export const NumbersTable = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);

  const { data: numbers = [], isLoading } = useGetNumbersQuery();
  const [deleteNumber] = useDeleteNumberMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteNumbersMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter((n) => {
      const name = (n.name || '').toLowerCase();
      const comment = ((n as { comment?: string }).comment || n.description || '').toLowerCase();
      return name.includes(q) || comment.includes(q);
    });
  }, [numbers, globalFilter]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: t('numbers.name'),
      cell: (info) => (
        <Text className={styles.nameCell}>{info.getValue() as string}</Text>
      ),
    },
    {
      accessorKey: 'comment',
      header: t('numbers.comment'),
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => {
        const row = info.row.original;
        return (
          <TableRowActions>
            <TableRowAction
              title={t('common.edit')}
              aria-label={t('common.edit')}
              onClick={() => dispatch(numbersPageActions.openEditModal(row))}
            >
              <Pencil />
            </TableRowAction>
            <TableRowAction
              danger
              title={t('common.delete')}
              aria-label={t('common.delete')}
              onClick={() => {
                if (window.confirm(t('common.confirmDelete', `Delete ${row.name}?`))) {
                  void deleteNumber(row.id);
                }
              }}
            >
              <Trash2 />
            </TableRowAction>
          </TableRowActions>
        );
      },
    },
  ], [t, deleteNumber, dispatch]);

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;

    if (window.confirm(t('common.confirmDelete', 'Are you sure you want to delete?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  const toolbar = (
    <HStack justify="between" align="center" className={styles.toolbar} max>
      <HStack gap="8" align="center">
        <Hash className={styles.toolbarIcon} />
        <Text className={styles.toolbarTitle}>
          {numbers.length} {t('nav.numbers')}
        </Text>
      </HStack>
      <HStack gap="12" align="center" className={styles.toolbarActions}>
        {selectedCount > 0 && !isMobile && (
          <Button variant="destructive" disabled={isDeleting} onClick={() => void handleBulkDelete()}>
            {isDeleting ? (
              <Loader2 className={styles.iconSpin} />
            ) : (
              <Trash2 className={styles.actionIcon} />
            )}
            {t('common.deleteSelected')} ({selectedCount})
          </Button>
        )}
        <VStack className={styles.searchWrap}>
          <Search className={styles.searchIcon} />
          <Input
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={styles.searchInput}
          />
        </VStack>
      </HStack>
    </HStack>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={styles.loading}>
            <Loader2 className={styles.loadingIcon} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  // D-29 hybrid: critical columns as cards on phone
  if (isMobile) {
    return (
      <Card data-testid="numbers-mobile-cards">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max>
            {filtered.length === 0 ? (
              <Text variant="muted" className={styles.emptyState}>
                {t('common.noData')}
              </Text>
            ) : (
              filtered.map((row) => (
                <VStack key={row.id} gap="0" max className={styles.mobileCard}>
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text className={styles.nameCell}>{row.name}</Text>
                      <Text variant="muted" className={styles.mobileComment}>
                        {(row as { comment?: string }).comment || row.description || '-'}
                      </Text>
                    </VStack>
                    <TableRowActions>
                      <TableRowAction
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        onClick={() => dispatch(numbersPageActions.openEditModal(row))}
                      >
                        <Pencil />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('common.confirmDelete'))) {
                            void deleteNumber(row.id);
                          }
                        }}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
                  </HStack>
                </VStack>
              ))
            )}
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={styles.tableContent}>
        <VStack className={styles.tableScroll} data-testid="numbers-table-scroll" max>
          <DataTable
            data={numbers}
            columns={columns}
            getRowId={(row) => String(row.id)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            emptyText={t('common.noData')}
            exportFilename="numbers_export"
          />
        </VStack>
      </CardContent>
    </Card>
  );
};
