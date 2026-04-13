import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Search, Loader2, Route, Pencil, Copy, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input, Button, DataTable } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { 
  useGetRoutesByContextQuery, 
  useDeleteRouteMutation, 
  useBulkDeleteRoutesMutation,
  useDuplicateRouteMutation, 
  type IRoute 
} from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import styles from './RoutesTable.module.scss';

const columnHelper = createColumnHelper<IRoute>();

export const RoutesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedContextUid = useAppSelector((s) => s.routes.selectedContextUid);

  const { data: routes = [], isLoading } = useGetRoutesByContextQuery(
    selectedContextUid!, { skip: !selectedContextUid },
  );
  const [deleteRoute] = useDeleteRouteMutation();
  const [bulkDelete, { isLoading: isDeleting }] = useBulkDeleteRoutesMutation();
  const [duplicateRoute] = useDuplicateRouteMutation();

  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useMemo(() => [
    columnHelper.accessor('priority', {
      header: '№',
      size: 50,
      cell: (info) => <span className={styles.priority}>{info.row.index + 1}</span>,
    }),
    columnHelper.accessor('active', {
      header: t('common.active', 'Активен'),
      size: 80,
      cell: (info) => (
        <span className={info.getValue() ? styles.badgeActive : styles.badgeInactive}>
          {info.getValue() ? '●' : '○'}
        </span>
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
        <div className={styles.extChips}>
          {(info.getValue() || []).map((ext) => (
            <code key={ext} className={styles.extChip}>{ext}</code>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('actions', {
      header: t('routes.actionsCount', 'Действия'),
      size: 100,
      cell: (info) => <span className={styles.count}>{info.getValue()?.length || 0}</span>,
    }),
    columnHelper.display({
      id: 'tableActions',
      size: 100,
      cell: (info) => {
        const route = info.row.original;
        return (
          <HStack gap="4">
            <button className={styles.actionBtn} onClick={() => dispatch(routesActions.openEditModal(route))} title={t('common.edit')}>
              <Pencil className="w-4 h-4" />
            </button>
            <button className={styles.actionBtn} onClick={() => duplicateRoute(route.uid)} title={t('routes.duplicate', 'Копировать')}>
              <Copy className="w-4 h-4" />
            </button>
            <button className={styles.actionBtnDanger} onClick={() => { if (window.confirm(t('routes.confirmDelete', `Удалить маршрут «${route.name}»?`))) deleteRoute(route.uid); }} title={t('common.delete')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </HStack>
        );
      },
    }),
  ], [t, dispatch, deleteRoute, duplicateRoute]);

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).map(Number);
    if (!ids.length) return;
    
    if (window.confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить?'))) {
      await bulkDelete(ids).unwrap();
      setRowSelection({});
    }
  };

  if (!selectedContextUid) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Route className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">
            {t('routes.selectContextHint', 'Выберите контекст для просмотра маршрутов')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <Route className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('routes.count', { count: routes.length, defaultValue: `Маршрутов: ${routes.length}` })}
            </span>
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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="routes-search" placeholder={t('common.search', 'Поиск...')} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="pl-10 h-9" />
            </div>
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
            data={routes}
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

