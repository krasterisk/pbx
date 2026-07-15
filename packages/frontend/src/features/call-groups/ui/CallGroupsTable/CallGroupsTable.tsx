import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { DataTable, HStack, Button } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  useGetCallGroupsQuery,
  useDeleteCallGroupMutation,
} from '@/shared/api/endpoints/callGroupApi';
import type { ICallGroup } from '@krasterisk/shared';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';

const STRATEGY_KEYS = ['ringall', 'hunt', 'memoryhunt', 'random'] as const;

export const CallGroupsTable = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: callGroups = [] } = useGetCallGroupsQuery();
  const [deleteCallGroup] = useDeleteCallGroupMutation();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const handleEdit = useCallback((uid: number) => {
    dispatch(callGroupsPageActions.openEditModal(uid));
  }, [dispatch]);

  const handleDelete = useCallback(async (group: ICallGroup) => {
    if (!window.confirm(t('callGroups.confirmDelete', { name: group.name, defaultValue: `Удалить группу "${group.name}"?` }))) {
      return;
    }
    await deleteCallGroup(group.uid);
  }, [deleteCallGroup, t]);

  const handleCopy = useCallback((uid: number) => {
    dispatch(callGroupsPageActions.openCopyModal(uid));
  }, [dispatch]);

  const columns: ColumnDef<ICallGroup>[] = [
    {
      accessorKey: 'name',
      header: t('callGroups.name', 'Название'),
      size: 200,
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'strategy',
      header: t('callGroups.strategy', 'Стратегия'),
      size: 150,
      cell: ({ row }) => {
        const strategy = row.original.strategy;
        const label = STRATEGY_KEYS.includes(strategy as typeof STRATEGY_KEYS[number])
          ? t(`callGroups.strategy.${strategy}`)
          : strategy;
        return <span className="text-sm">{label || '—'}</span>;
      },
    },
    {
      id: 'memberCount',
      accessorFn: (row) => row.members?.length ?? 0,
      header: t('callGroups.members', 'Участники'),
      size: 100,
      cell: ({ row }) => {
        const count = row.original.members?.length ?? 0;
        return (
          <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium ${
            count > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
          >
            {count}
          </span>
        );
      },
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
            onClick={() => handleEdit(row.original.uid)}
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original.uid)}
            title={t('common.copy')}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original)}
            title={t('common.delete')}
            className="hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={callGroups}
      getRowId={(row) => String(row.uid)}
      selectable={false}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      emptyText={t('callGroups.noGroups', 'Нет групп вызовов')}
      exportFilename="call_groups_export"
    />
  );
};
