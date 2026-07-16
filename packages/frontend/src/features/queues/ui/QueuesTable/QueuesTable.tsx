import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { DataTable, HStack, Button, Text, VStack } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useGetQueuesQuery, useDeleteQueueMutation } from '@/shared/api/endpoints/queueApi';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import { IQueue } from '../../model/types/queuesSchema';

const STRATEGY_LABELS: Record<string, string> = {
  ringall: 'Ring All',
  rrmemory: 'Round Robin',
  leastrecent: 'Least Recent',
  fewestcalls: 'Fewest Calls',
  random: 'Random',
  linear: 'Linear',
  wrandom: 'Weighted Random',
};

export const QueuesTable = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
  const { data: queues = [], isLoading } = useGetQueuesQuery();
  const [deleteQueue] = useDeleteQueueMutation();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const handleEdit = useCallback((name: string) => {
    dispatch(queuesPageActions.openEditModal(name));
  }, [dispatch]);

  const handleDelete = useCallback(async (name: string) => {
    if (!window.confirm(t('queues.confirmDelete', { name, defaultValue: `Удалить очередь "${name}"?` }))) return;
    await deleteQueue(name);
  }, [deleteQueue, t]);

  const handleCopy = useCallback((name: string) => {
    dispatch(queuesPageActions.openCopyModal(name));
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return queues;
    return queues.filter((row) => {
      const exten = (row.exten || row.name || '').toLowerCase();
      const display = (row.display_name || '').toLowerCase();
      const strategy = (row.strategy || '').toLowerCase();
      return exten.includes(q) || display.includes(q) || strategy.includes(q);
    });
  }, [queues, globalFilter]);

  const columns: ColumnDef<IQueue>[] = [
    {
      id: 'exten',
      accessorFn: (row) => row.exten || row.name,
      header: t('queues.exten', 'Номер'),
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-foreground">{row.original.exten || row.original.name}</span>
      ),
    },
    {
      accessorKey: 'display_name',
      header: t('queues.displayName', 'Название'),
      size: 180,
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.display_name || <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      accessorKey: 'strategy',
      header: t('queues.strategy', 'Стратегия'),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm">{STRATEGY_LABELS[row.original.strategy || ''] || row.original.strategy || '—'}</span>
      ),
    },
    {
      accessorKey: 'memberCount',
      header: t('queues.members', 'Операторы'),
      size: 100,
      cell: ({ row }) => (
        <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium ${
          (row.original.memberCount || 0) > 0
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}>
          {row.original.memberCount || 0}
        </span>
      ),
    },
    {
      accessorKey: 'timeout',
      header: t('queues.timeout', 'Таймаут'),
      size: 80,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.timeout ?? '—'}s</span>,
    },
    {
      accessorKey: 'maxlen',
      header: t('queues.maxlen', 'Макс.'),
      size: 80,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.maxlen || '∞'}</span>,
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <HStack gap="4" align="center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original.name)}
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original.name)}
            title={t('common.copy')}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.name)}
            title={t('common.delete')}
            className="hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      ),
    },
  ];

  // D-29 hybrid: critical columns as cards on phone
  if (isMobile) {
    return (
      <div data-testid="hybrid-table" data-hybrid="mobile-card" className="p-3">
        <input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={t('common.search')}
          className="mb-3 w-full h-9 rounded-md border border-border bg-background px-3 text-sm min-w-0"
          aria-label={t('common.search')}
        />
        <VStack gap="8" max>
          {isLoading ? (
            <Text variant="muted" className="py-8 text-center w-full">{t('common.loading', '…')}</Text>
          ) : filtered.length === 0 ? (
            <Text variant="muted" className="py-8 text-center w-full">
              {t('queues.noQueues', 'Нет очередей')}
            </Text>
          ) : (
            filtered.map((row) => (
              <div
                key={row.name}
                className="rounded-lg border border-border/60 bg-muted/10 p-3 mobile-card"
              >
                <HStack justify="between" align="start" max>
                  <VStack gap="4">
                    <Text className="font-mono font-semibold">{row.exten || row.name}</Text>
                    <Text className="text-sm">{row.display_name || '—'}</Text>
                    <Text variant="muted" className="text-xs">
                      {STRATEGY_LABELS[row.strategy || ''] || row.strategy || '—'}
                      {' · '}
                      {row.memberCount || 0} {t('queues.members', 'Операторы').toLowerCase()}
                    </Text>
                  </VStack>
                  <HStack gap="4">
                    <button
                      className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                      title={t('common.edit')}
                      onClick={() => handleEdit(row.name)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                      title={t('common.copy')}
                      onClick={() => handleCopy(row.name)}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      title={t('common.delete')}
                      onClick={() => handleDelete(row.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </HStack>
                </HStack>
              </div>
            ))
          )}
        </VStack>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto min-w-0" data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <DataTable
        columns={columns}
        data={queues}
        getRowId={(row: any) => row.name}
        selectable={false}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        emptyText={t('queues.noQueues', 'Нет очередей')}
        exportFilename="queues_export"
      />
    </div>
  );
};
