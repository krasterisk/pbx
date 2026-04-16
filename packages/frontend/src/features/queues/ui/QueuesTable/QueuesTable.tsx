import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { DataTable, HStack, Button } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
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
  const { data: queues = [], isLoading } = useGetQueuesQuery();
  const [deleteQueue] = useDeleteQueueMutation();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleEdit = useCallback((name: string) => {
    dispatch(queuesPageActions.openEditModal(name));
  }, [dispatch]);

  const handleDelete = useCallback(async (name: string) => {
    if (!window.confirm(t('queues.confirmDelete', { name, defaultValue: `Удалить очередь "${name}"?` }))) return;
    await deleteQueue(name);
  }, [deleteQueue, t]);

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
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => handleEdit(row.original.name)}
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => handleDelete(row.original.name)}
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </HStack>
      ),
    },
  ];

  return (
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
  );
};
