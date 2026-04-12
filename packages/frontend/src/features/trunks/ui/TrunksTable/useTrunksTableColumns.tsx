import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { HStack } from '@/shared/ui/Stack';
import { Button } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { useDeleteTrunkMutation } from '@/shared/api/endpoints/trunkApi';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';

const columnHelper = createColumnHelper<ITrunkListItem>();

export const useTrunksTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteTrunk] = useDeleteTrunkMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('trunks.name'),
        cell: (info) => (
          <span className="font-semibold text-primary">{info.getValue()}</span>
        ),
      }),

      columnHelper.accessor('trunkType', {
        header: () => t('trunks.type'),
        cell: (info) => {
          const type = info.getValue();
          return (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                type === 'auth'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {type === 'auth' ? t('trunks.typeAuth') : t('trunks.typeIp')}
            </span>
          );
        },
      }),

      columnHelper.accessor('host', {
        header: () => t('trunks.host'),
        cell: (info) => (
          <span className="text-sm font-mono">{info.getValue() || '—'}</span>
        ),
      }),

      columnHelper.accessor('username', {
        header: () => t('trunks.username'),
        cell: (info) => (
          <span className="text-sm font-mono text-muted-foreground">
            {info.getValue() || '—'}
          </span>
        ),
      }),

      columnHelper.accessor('context', {
        header: () => t('trunks.context', 'Контекст'),
        cell: (info) => (
          <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
            {info.getValue() || '—'}
          </span>
        ),
      }),

      columnHelper.accessor('registrationStatus', {
        header: () => t('trunks.status', 'Статус'),
        cell: (info) => {
          const status = info.getValue();
          const trunkType = info.row.original.trunkType;

          if (trunkType !== 'auth') {
            return <span className="text-xs text-muted-foreground">IP</span>;
          }

          const isRegistered = status === 'Registered';
          const isRejected = status === 'Rejected';

          return (
            <HStack gap="4" align="center">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRegistered
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                    : isRejected
                      ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                      : 'bg-zinc-600'
                }`}
              />
              <span
                className={`text-xs ${
                  isRegistered
                    ? 'text-emerald-400'
                    : isRejected
                      ? 'text-red-400'
                      : 'text-zinc-500'
                }`}
              >
                {status || 'unknown'}
              </span>
            </HStack>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const trunk = info.row.original;
          return (
            <HStack gap="4">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('common.edit')}
                onClick={() => dispatch(trunksPageActions.openEditModal(trunk))}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('trunks.copy', 'Копировать')}
                onClick={() => dispatch(trunksPageActions.openCopyModal(trunk))}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('trunks.confirmDelete', { name: trunk.name }))) {
                    deleteTrunk(trunk.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </HStack>
          );
        },
      }),
    ],
    [t, dispatch, deleteTrunk],
  );
};
