import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2, Key } from 'lucide-react';
import { HStack } from '@/shared/ui/Stack';
import { TableRowActions, TableRowAction } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useDeleteEndpointMutation } from '@/shared/api/endpoints/endpointApi';
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
        sortingFn: (rowA, rowB, columnId) => {
          const a = String(rowA.getValue(columnId));
          const b = String(rowB.getValue(columnId));
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB) && String(numA) === a && String(numB) === b) {
            return numA - numB;
          }
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        },
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
          <span className="text-sm">{info.getValue() || '-'}</span>
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
          const webrtc = info.row.original.webrtc;
          const webrtcEnabled = !!info.row.original.webrtc_enabled;
          return (
            <HStack gap="4" align="center" wrap="wrap">
              <span
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`}
              />
              <span className={`text-xs ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isOnline ? t('endpoints.statusOnline') : t('endpoints.statusOffline')}
              </span>
              {webrtcEnabled && (
                <HStack
                  gap="4"
                  align="center"
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    webrtc?.status === 'online'
                      ? 'border-sky-500/40 text-sky-400 bg-sky-500/10'
                      : 'border-border text-muted-foreground'
                  }`}
                  title={webrtc?.id || 'WebRTC'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      webrtc?.status === 'online' ? 'bg-sky-400' : 'bg-zinc-500'
                    }`}
                  />
                  WebRTC
                </HStack>
              )}
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
              {info.getValue() || '-'}
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
            <TableRowActions>
              <TableRowAction
                title={t('endpoints.btnSip')}
                aria-label={t('endpoints.btnSip')}
                onClick={() => dispatch(endpointsPageActions.openCredentialsModal(ep.id))}
              >
                <Key />
              </TableRowAction>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(endpointsPageActions.openEditModal(ep))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('endpoints.confirmDelete', { ext: ep.extension }))) {
                    deleteEndpoint(ep.id);
                  }
                }}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, deleteEndpoint],
  );
};
