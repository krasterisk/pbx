import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Loader2, Route, Pencil, Copy, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable, Text } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import {
  useGetAllRoutesQuery,
  useDeleteRouteMutation,
  useBulkDeleteRoutesMutation,
  type IRoute,
} from '@/shared/api/endpoints/routeApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import styles from './RoutesTable.module.scss';

const columnHelper = createColumnHelper<IRoute>();

export const RoutesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedContextUids = useAppSelector((s) => s.routes.selectedContextUids);

  const { data: allRoutes = [], isLoading } = useGetAllRoutesQuery();
  const { data: contexts = [] } = useGetContextsQuery();
  const [deleteRoute] = useDeleteRouteMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRoutesMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  /** Map context_uid -> context name for display */
  const contextMap = useMemo(() => {
    const map: Record<number, string> = {};
    contexts.forEach((c) => { map[c.uid] = c.name; });
    return map;
  }, [contexts]);

  /** Client-side filter by selected contexts */
  const filteredRoutes = useMemo(() => {
    if (selectedContextUids.length === 0) return allRoutes;
    return allRoutes.filter((r) => selectedContextUids.includes(r.context_uid));
  }, [allRoutes, selectedContextUids]);

  const columns = useMemo(() => [
    columnHelper.accessor('priority', {
      header: '№',
      size: 50,
      cell: (info) => <Text className={styles.priority}>{info.row.index + 1}</Text>,
    }),
    columnHelper.accessor('active', {
      header: t('common.active', 'Активен'),
      size: 80,
      cell: (info) => (
        <Text className={info.getValue() ? styles.badgeActive : styles.badgeInactive}>
          {info.getValue() ? '●' : '○'}
        </Text>
      ),
    }),
    columnHelper.accessor('context_uid', {
      header: t('routes.context', 'Контекст'),
      size: 160,
      cell: (info) => (
        <Text className={styles.contextName}>
          {contextMap[info.getValue()] || String(info.getValue())}
        </Text>
      ),
    }),
    columnHelper.accessor('name', {
      header: t('routes.name', 'Название'),
      size: 200,
    }),
    columnHelper.accessor('extensions', {
      header: t('routes.extensions', 'Extensions'),
      size: 220,
      cell: (info) => (
        <HStack gap="2" className={styles.extChips}>
          {(info.getValue() || []).map((ext) => (
            <Text key={ext} as="code" className={styles.extChip}>{ext}</Text>
          ))}
        </HStack>
      ),
    }),
    columnHelper.accessor('actions', {
      header: t('routes.actionsCount', 'Действия'),
      size: 100,
      cell: (info) => <Text className={styles.count}>{info.getValue()?.length || 0}</Text>,
    }),
    columnHelper.display({
      id: 'tableActions',
      size: 100,
      cell: (info) => {
        const route = info.row.original;
        return (
          <HStack gap="4">
            <Button variant="ghost" size="sm" className={styles.actionBtn} onClick={() => dispatch(routesActions.openEditModal(route))} title={t('common.edit')}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className={styles.actionBtn} onClick={() => dispatch(routesActions.openCopyModal(route))} title={t('common.copy', 'Копировать')}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className={styles.actionBtnDanger} onClick={() => { if (window.confirm(t('routes.confirmDelete', `Удалить маршрут «${route.name}»?`))) deleteRoute(route.uid); }} title={t('common.delete')}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </HStack>
        );
      },
    }),
  ], [t, dispatch, deleteRoute, contextMap]);

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;

    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <Route className="w-5 h-5 text-primary" />
            <Text className="font-semibold text-lg">
              {t('routes.count', { count: filteredRoutes.length, defaultValue: `Маршрутов: ${filteredRoutes.length}` })}
            </Text>
          </HStack>
          <HStack gap="12" align="center" className="w-full sm:w-auto">
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={handleBulkDelete}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('common.deleteSelected', 'Удалить выбранные')} ({selectedCount})
              </Button>
            )}
            <Input
              id="routes-search"
              placeholder={t('common.search', 'Поиск...')}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="sm:w-64 h-9"
            />
          </HStack>
        </HStack>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        ) : (
          <DataTable
            data={filteredRoutes}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            globalFilter={globalFilter}
            selectable={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageSize={50}
            exportFilename="routes_export"
          />
        )}
      </CardContent>
    </Card>
  );
});

RoutesTable.displayName = 'RoutesTable';
