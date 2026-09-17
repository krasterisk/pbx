import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { Flex, HStack } from '@/shared/ui/Stack';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteRouteMutation, type IRoute } from '@/shared/api/endpoints/routeApi';
import { routesActions } from '../../model/slice/routesSlice';
import cls from './RoutesTable.module.scss';

const columnHelper = createColumnHelper<IRoute>();

export const useRoutesTableColumns = (contextMap: Record<number, string>) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteRoute] = useDeleteRouteMutation();

  return useMemo(
    () => [
      columnHelper.accessor('priority', {
        header: () => t('routes.priority'),
        size: 50,
        cell: (info) => (
          <Text as="span" className={cls.priority}>{info.row.index + 1}</Text>
        ),
      }),

      columnHelper.accessor('active', {
        header: () => t('common.active'),
        size: 80,
        cell: (info) => {
          const isActive = !!info.getValue();
          return (
            <Flex
              className={isActive ? cls.statusDotActive : cls.statusDotInactive}
              title={isActive ? t('common.active') : t('common.inactive')}
              aria-label={isActive ? t('common.active') : t('common.inactive')}
            >
              {''}
            </Flex>
          );
        },
      }),

      columnHelper.accessor('context_uid', {
        header: () => t('routes.context'),
        size: 160,
        cell: (info) => (
          <Text as="span" className={cls.contextName}>
            {contextMap[info.getValue()] || String(info.getValue())}
          </Text>
        ),
      }),

      columnHelper.accessor('name', {
        header: () => t('routes.name'),
        size: 200,
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('extensions', {
        header: () => t('routes.extensions'),
        size: 220,
        cell: (info) => (
          <HStack gap="2" className={cls.extChips}>
            {(info.getValue() || []).map((ext) => (
              <Text key={ext} as="span" className={cls.extChip}>{ext}</Text>
            ))}
          </HStack>
        ),
      }),

      columnHelper.accessor('actions', {
        header: () => t('routes.actionsCount'),
        size: 100,
        cell: (info) => (
          <Text as="span" className={cls.actionsCount}>{info.getValue()?.length || 0}</Text>
        ),
      }),

      columnHelper.display({
        id: 'tableActions',
        header: () => t('common.actions'),
        size: 100,
        cell: (info) => {
          const route = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(routesActions.openEditModal(route))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(routesActions.openCopyModal(route))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('routes.confirmDelete', { name: route.name }))) {
                    deleteRoute(route.uid);
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
    [t, dispatch, deleteRoute, contextMap],
  );
};
