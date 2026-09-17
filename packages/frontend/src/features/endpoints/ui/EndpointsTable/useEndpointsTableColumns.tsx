import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2, Key } from 'lucide-react';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useDeleteEndpointMutation } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import cls from './EndpointsTable.module.scss';

const columnHelper = createColumnHelper<IEndpointListItem>();

export const useEndpointsTableColumns = () => {
  const { t, i18n } = useTranslation();
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
        cell: (info) => <Text as="span" className={cls.extension}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('callerid', {
        header: () => t('endpoints.callerid'),
        cell: (info) => {
          const raw = info.getValue() || '';
          const match = raw.match(/^"(.+?)"/);
          return <Text as="span" className={cls.cell}>{match ? match[1] : raw || '-'}</Text>;
        },
      }),

      columnHelper.accessor('department', {
        header: () => t('endpoints.department'),
        cell: (info) => <Text as="span" className={cls.cell}>{info.getValue() || '-'}</Text>,
      }),

      columnHelper.accessor('context', {
        header: () => t('endpoints.context'),
        cell: (info) => (
          <Text as="span" className={cls.contextChip}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor('status', {
        header: () => t('endpoints.status'),
        cell: (info) => {
          const isOnline = info.getValue() === 'online';
          const lastReg = info.row.original.lastRegistered;
          const webrtc = info.row.original.webrtc;
          const webrtcEnabled = !!info.row.original.webrtc_enabled;
          const webrtcOnline = webrtc?.status === 'online';
          const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU';
          return (
            <HStack gap="4" align="center" wrap="wrap">
              <Flex className={isOnline ? cls.statusDotOnline : cls.statusDotOffline}>{''}</Flex>
              <Text as="span" className={isOnline ? cls.statusOnline : cls.statusOffline}>
                {isOnline ? t('endpoints.statusOnline') : t('endpoints.statusOffline')}
              </Text>
              {webrtcEnabled && (
                <HStack
                  gap="4"
                  align="center"
                  className={webrtcOnline ? cls.webrtcBadgeOnline : cls.webrtcBadge}
                  title={webrtc?.id || t('endpoints.credWebrtc')}
                >
                  <Flex className={webrtcOnline ? cls.webrtcDotOnline : cls.webrtcDot}>{''}</Flex>
                  <Text as="span" className={cls.webrtcLabel}>{t('endpoints.credWebrtc')}</Text>
                </HStack>
              )}
              {lastReg && (
                <Text as="span" className={cls.lastReg}>
                  {new Date(lastReg * 1000).toLocaleString(locale, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </HStack>
          );
        },
      }),

      columnHelper.accessor('userAgent', {
        header: () => t('endpoints.network'),
        cell: (info) => (
          <VStack gap="2">
            {info.row.original.clientIp ? (
              <Text as="span" className={cls.mono}>{info.row.original.clientIp}</Text>
            ) : null}
            <Text as="span" className={cls.device} title={info.getValue() || ''}>
              {info.getValue() || '-'}
            </Text>
          </VStack>
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
    [t, i18n.language, dispatch, deleteEndpoint],
  );
};
