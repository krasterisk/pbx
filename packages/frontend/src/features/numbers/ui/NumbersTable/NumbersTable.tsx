import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Hash, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, DataTable, Button, Text } from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import { useGetNumbersQuery, useDeleteNumberMutation, useBulkDeleteNumbersMutation } from '@/shared/api/api';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { numbersPageActions } from '../../model/slice/numbersPageSlice';

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
      cell: (info) => <span className="font-medium text-white">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'comment',
      header: t('numbers.comment'),
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => (
        <HStack gap="4">
          <button
            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
            title={t('common.edit')}
            onClick={() => dispatch(numbersPageActions.openEditModal(info.row.original))}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title={t('common.delete')}
            onClick={() => {
              if (window.confirm(t('common.confirmDelete', `Delete ${info.row.original.name}?`))) {
                deleteNumber(info.row.original.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </HStack>
      ),
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
    <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
      <HStack gap="8" align="center">
        <Hash className="w-5 h-5 text-primary" />
        <span className="font-semibold text-lg">
          {numbers.length} {t('nav.numbers')}
        </span>
      </HStack>
      <HStack gap="12" align="center" className="w-full sm:w-auto">
        {selectedCount > 0 && !isMobile && (
          <Button variant="destructive" disabled={isDeleting} onClick={handleBulkDelete}>
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {t('common.deleteSelected')} ({selectedCount})
          </Button>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </HStack>
    </HStack>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
              <Text variant="muted" className="py-8 text-center w-full">
                {t('common.noData')}
              </Text>
            ) : (
              filtered.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border/60 bg-muted/10 p-3"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <Text className="font-medium">{row.name}</Text>
                      <Text variant="muted" className="text-xs">
                        {(row as { comment?: string }).comment || row.description || '-'}
                      </Text>
                    </VStack>
                    <HStack gap="4">
                      <button
                        className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                        title={t('common.edit')}
                        onClick={() => dispatch(numbersPageActions.openEditModal(row))}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        title={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('common.confirmDelete'))) {
                            deleteNumber(row.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </HStack>
                  </HStack>
                </div>
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
      <CardContent className="p-0">
        <div className="overflow-x-auto min-w-0" data-testid="numbers-table-scroll">
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
        </div>
      </CardContent>
    </Card>
  );
};
