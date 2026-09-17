import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Search, Loader2, Trash2, Pencil, Copy } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  DataTable,
  Text,
  TableRowActions,
  TableRowAction,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetAllRoutesQuery,
  useDeleteRouteMutation,
  useBulkDeleteRoutesMutation,
} from '@/shared/api/endpoints/routeApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { routesActions } from '../../model/slice/routesSlice';
import { useRoutesTableColumns } from './useRoutesTableColumns';
import cls from './RoutesTable.module.scss';

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

  const contextMap = useMemo(() => {
    const map: Record<number, string> = {};
    contexts.forEach((c) => { map[c.uid] = c.name; });
    return map;
  }, [contexts]);

  const filteredRoutes = useMemo(() => {
    if (selectedContextUids.length === 0) return allRoutes;
    return allRoutes.filter((r) => selectedContextUids.includes(r.context_uid));
  }, [allRoutes, selectedContextUids]);

  const columns = useRoutesTableColumns(contextMap);
  const selectedCount = Object.keys(rowSelection).length;

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

  const handleBulkDelete = useCallback(async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    if (!window.confirm(t('routes.confirmBulkDelete'))) return;
    await bulkDelete(ids).unwrap();
    setRowSelection({});
  }, [rowSelection, bulkDelete, t]);

  const toolbar = (
    <Flex justify="between" align="center" className={cls.toolbar} max>
      <HStack gap="8" align="center">
        <Route size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>{t('routes.count', { count: filteredRoutes.length })}</Text>
      </HStack>
      <HStack gap="8" align="center" className={cls.toolbarActions}>
        {!isMobile && (
          <Button
            variant="destructive"
            className={selectedCount === 0 ? cls.bulkBtnHidden : undefined}
            disabled={isDeleting || selectedCount === 0}
            aria-hidden={selectedCount === 0}
            tabIndex={selectedCount === 0 ? -1 : undefined}
            onClick={handleBulkDelete}
          >
            {isDeleting ? <Loader2 size={16} className={cls.spinner} /> : <Trash2 size={16} />}
            {t('routes.deleteSelected', { count: selectedCount })}
          </Button>
        )}
        <Flex align="center" className={cls.searchWrap}>
          <Search size={16} className={cls.searchIcon} />
          <Input
            id="routes-search"
            placeholder={t('common.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cls.searchInput}
          />
        </Flex>
      </HStack>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <Flex align="center" justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card className={cls.card} data-testid="hybrid-table" data-hybrid="mobile-card">
        <CardHeader>{toolbar}</CardHeader>
        <CardContent>
          <VStack gap="8" max className={cls.mobileList}>
            {searchFiltered.length === 0 ? (
              <Text variant="muted" className={cls.mobileEmpty}>
                {t('routes.noRoutes')}
              </Text>
            ) : (
              searchFiltered.map((route) => {
                const isActive = !!route.active;
                return (
                  <Flex
                    key={route.uid}
                    direction="column"
                    className={cls.mobileCard}
                    data-testid="routes-mobile-card"
                  >
                    <HStack justify="between" align="start" max>
                      <VStack gap="4">
                        <HStack gap="8" align="center">
                          <Flex
                            className={isActive ? cls.statusDotActive : cls.statusDotInactive}
                            title={isActive ? t('common.active') : t('common.inactive')}
                            aria-label={isActive ? t('common.active') : t('common.inactive')}
                          >
                            {''}
                          </Flex>
                          <Text as="span" className={cls.name}>{route.name}</Text>
                        </HStack>
                        <Text as="span" className={cls.contextName}>
                          {contextMap[route.context_uid] || String(route.context_uid)}
                        </Text>
                        <HStack gap="2" className={cls.extChips} wrap="wrap">
                          {(route.extensions || []).slice(0, 4).map((ext) => (
                            <Text key={ext} as="span" className={cls.extChip}>{ext}</Text>
                          ))}
                        </HStack>
                      </VStack>
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
                    </HStack>
                  </Flex>
                );
              })
            )}
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
      <CardHeader>{toolbar}</CardHeader>
      <CardContent className={cls.cardContent}>
        <Flex
          direction="column"
          align="stretch"
          className={cls.tableScroll}
          data-testid="routes-table-scroll"
        >
          <DataTable
            className={cls.table}
            data={filteredRoutes}
            columns={columns}
            getRowId={(row) => String(row.uid)}
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            globalFilter={globalFilter}
            pageSize={50}
            emptyText={t('routes.noRoutes')}
            exportFilename="routes_export"
          />
        </Flex>
      </CardContent>
    </Card>
  );
});

RoutesTable.displayName = 'RoutesTable';
