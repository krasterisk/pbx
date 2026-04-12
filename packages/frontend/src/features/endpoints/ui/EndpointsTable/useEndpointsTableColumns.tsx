import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2, Key } from 'lucide-react';
import { HStack } from '@/shared/ui/Stack';
import { Button } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useDeleteEndpointMutation, useLazyGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';

const columnHelper = createColumnHelper<IEndpointListItem>();

export const useEndpointsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteEndpoint] = useDeleteEndpointMutation();

  return useMemo(
    () => [
      columnHelper.accessor('extension', {
        header: () => t('endpoints.extension'),
        cell: (info) => (
          <span className="font-mono font-semibold text-primary">{info.getValue()}</span>
        ),
      }),

      columnHelper.accessor('callerid', {
        header: () => t('endpoints.callerid'),
        cell: (info) => {
          const raw = info.getValue() || '';
          // Parse "Name" <100> → "Name"
          const match = raw.match(/^"(.+?)"/);
          return match ? match[1] : raw;
        },
      }),

      columnHelper.accessor('department', {
        header: () => t('endpoints.department', 'Отдел'),
        cell: (info) => (
          <span className="text-sm">{info.getValue() || '—'}</span>
        ),
      }),

      columnHelper.accessor('context', {
        header: () => t('endpoints.context'),
        cell: (info) => (
          <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
            {info.getValue()}
          </span>
        ),
      }),

      columnHelper.accessor('status', {
        header: () => t('endpoints.status'),
        cell: (info) => {
          const isOnline = info.getValue() === 'online';
          const lastReg = info.row.original.lastRegistered;
          return (
            <HStack gap="4" align="center">
              <span
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`}
              />
              <span className={`text-xs ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isOnline ? t('endpoints.statusOnline') : t('endpoints.statusOffline')}
              </span>
              {lastReg && (
                <span className="text-[10px] text-zinc-500 hidden sm:inline">
                  {new Date(lastReg * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </HStack>
          );
        },
      }),

      columnHelper.accessor('userAgent', {
        header: () => t('endpoints.network', 'Сеть / Устройство'),
        cell: (info) => (
          <div className="flex flex-col">
            {info.row.original.clientIp ? (
              <span className="text-xs font-mono text-primary mb-1">
                {info.row.original.clientIp}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={info.getValue() || ''}>
              {info.getValue() || '—'}
            </span>
          </div>
        ),
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const ep = info.row.original;
          return (
            <HStack gap="4">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-xs font-semibold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
                onClick={() => dispatch(endpointsPageActions.openCredentialsModal(ep.id))}
              >
                <Key className="w-3 h-3" />
                <span className="hidden sm:inline">{t('endpoints.btnSip', 'SIP')}</span>
                <span className="sm:hidden">SIP</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => dispatch(endpointsPageActions.openEditModal(ep))}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(t('endpoints.confirmDelete', { ext: ep.extension }))) {
                    deleteEndpoint(ep.id);
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
    [t, dispatch, deleteEndpoint],
  );
};
