import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Loader2, Route, Pencil, Copy, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable, Text } from '@/shared/ui';
import { HStack, Flex, VStack } from '@/shared/ui/Stack';
import {
  useGetAllRoutesQuery,
  useDeleteRouteMutation,
  useBulkDeleteRoutesMutation,
  type IRoute,
} from '@/shared/api/endpoints/routeApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { routesActions } from '../../model/slice/routesSlice';
import styles from './RoutesTable.module.scss';

const columnHelper = createColumnHelper<IRoute>();

export const RoutesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile(768);
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

  const searchFiltered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return filteredRoutes;
    return filteredRoutes.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const ctx = (contextMap[r.context_uid] || String(r.context_uid)).toLowerCase();
      const ext = (r.extensions || []).join(' ').toLowerCase();
      return name.includes(q) || ctx.includes(q) || ext.includes(q);
    });
  }, [filteredRoutes, globalFilter, contextMap]);

  const toolbar = (
    <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
      <HStack gap="8" align="center">
        <Route className="w-5 h-5 text-primary" />
        <Text className="font-semibold text-lg">
          {t('routes.count', { count: filteredRoutes.length, defaultValue: `Маршрутов: ${filteredRoutes.length}` })}
        </Text>
      </HStack>
      <HStack gap="12" align="center" className="w-full sm:w-auto">
        {selectedCount > 0 && !isMobile && (
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
          className="w-full sm:w-64 h-9 min-w-0"
        />
      </HStack>
    </HStack>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  // D-29 hybrid: critical columns as cards on phone
  if (isMobile) {
    return (
      <Card data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max>
            {searchFiltered.length === 0 ? (
              <Text variant="muted" className="py-8 text-center w-full">
                {t('common.noData')}
              </Text>
            ) : (
              searchFiltered.map((route) => (
                <div
                  key={route.uid}
                  className="rounded-lg border border-border/60 bg-muted/10 p-3 mobile-card"
                >
                  <HStack justify="between" align="start" max>
                    <VStack gap="4">
                      <HStack gap="8" align="center">
                        <Text className={route.active ? styles.badgeActive : styles.badgeInactive}>
                          {route.active ? '●' : '○'}
                        </Text>
                        <Text className="font-medium">{route.name}</Text>
                      </HStack>
                      <Text variant="muted" className="text-xs">
                        {contextMap[route.context_uid] || String(route.context_uid)}
                      </Text>
                      <HStack gap="2" className={styles.extChips} wrap="wrap">
                        {(route.extensions || []).slice(0, 4).map((ext) => (
                          <Text key={ext} as="code" className={styles.extChip}>{ext}</Text>
                        ))}
                      </HStack>
                    </VStack>
                    <HStack gap="4">
                      <button
                        className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                        title={t('common.edit')}
                        onClick={() => dispatch(routesActions.openEditModal(route))}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
                        title={t('common.copy', 'Копировать')}
                        onClick={() => dispatch(routesActions.openCopyModal(route))}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        title={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('routes.confirmDelete', `Удалить маршрут «${route.name}»?`))) {
                            deleteRoute(route.uid);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </HStack>
                  </HStack>
                </div>
              ))
            )}
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto min-w-0" data-testid="routes-table-scroll">
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
        </div>
      </CardContent>
    </Card>
  );
});

RoutesTable.displayName = 'RoutesTable';
