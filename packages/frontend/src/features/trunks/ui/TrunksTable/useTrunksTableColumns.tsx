import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { Flex } from '@/shared/ui/Stack';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { useDeleteTrunkMutation } from '@/shared/api/endpoints/trunkApi';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import cls from './TrunksTable.module.scss';

const columnHelper = createColumnHelper<ITrunkListItem>();

function statusClass(status: string | undefined, trunkType: string) {
  if (trunkType !== 'auth') return cls.statusUnknown;
  if (status === 'Registered') return cls.statusRegistered;
  if (status === 'Rejected') return cls.statusRejected;
  return cls.statusUnknown;
}

function statusDotClass(status: string | undefined, trunkType: string) {
  if (trunkType !== 'auth') return cls.statusDotUnknown;
  if (status === 'Registered') return cls.statusDotRegistered;
  if (status === 'Rejected') return cls.statusDotRejected;
  return cls.statusDotUnknown;
}

export const useTrunksTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteTrunk] = useDeleteTrunkMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('trunks.name'),
        cell: (info) => <Text className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('trunkType', {
        header: () => t('trunks.type'),
        cell: (info) => {
          const type = info.getValue();
          return (
            <Text as="span" className={type === 'auth' ? cls.badgeAuth : cls.badgeIp}>
              {type === 'auth' ? t('trunks.typeAuth') : t('trunks.typeIp')}
            </Text>
          );
        },
      }),

      columnHelper.accessor('host', {
        header: () => t('trunks.host'),
        cell: (info) => <Text className={cls.mono}>{info.getValue() || '-'}</Text>,
      }),

      columnHelper.accessor('username', {
        header: () => t('trunks.username'),
        cell: (info) => <Text className={cls.mutedMono}>{info.getValue() || '-'}</Text>,
      }),

      columnHelper.accessor('context', {
        header: () => t('trunks.context', 'Контекст'),
        cell: (info) => (
          <Text as="span" className={cls.contextChip}>
            {info.getValue() || '-'}
          </Text>
        ),
      }),

      columnHelper.accessor('registrationStatus', {
        header: () => t('trunks.status', 'Статус'),
        cell: (info) => {
          const status = info.getValue();
          const trunkType = info.row.original.trunkType;

          if (trunkType !== 'auth') {
            return <Text variant="muted" className={cls.statusUnknown}>IP</Text>;
          }

          return (
            <Flex align="center" gap="4">
              <Flex className={statusDotClass(status ?? undefined, trunkType)}>{''}</Flex>
              <Text className={statusClass(status ?? undefined, trunkType)}>{status || 'unknown'}</Text>
            </Flex>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const trunk = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(trunksPageActions.openEditModal(trunk))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy', 'Копировать')}
                aria-label={t('common.copy', 'Копировать')}
                onClick={() => dispatch(trunksPageActions.openCopyModal(trunk))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('trunks.confirmDelete', { name: trunk.name }))) {
                    deleteTrunk(trunk.id);
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
    [t, dispatch, deleteTrunk],
  );
};
