import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, flexRender, type SortingState,
  createColumnHelper,
} from '@tanstack/react-table';
import { Search, Loader2, Route, Pencil, Copy, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useGetRoutesByContextQuery, useDeleteRouteMutation, useDuplicateRouteMutation, type IRoute } from '@/shared/api/api';
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
  const [duplicateRoute] = useDuplicateRouteMutation();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'priority', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');

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
            <button className={styles.actionBtnDanger} onClick={() => { if (confirm(t('routes.confirmDelete', `Удалить маршрут «${route.name}»?`))) deleteRoute(route.uid); }} title={t('common.delete')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </HStack>
        );
      },
    }),
  ], [t, dispatch, deleteRoute, duplicateRoute]);

  const table = useReactTable({
    data: routes,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="routes-search" placeholder={t('common.search', 'Поиск...')} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="pl-10 h-9" />
          </div>
        </HStack>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border">
                    {hg.headers.map((header) => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none transition-colors"
                      >
                        <HStack gap="4" align="center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && ' ↑'}
                          {header.column.getIsSorted() === 'desc' && ' ↓'}
                        </HStack>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                      {t('routes.noRoutes', 'Нет маршрутов в данном контексте')}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onDoubleClick={() => dispatch(routesActions.openEditModal(row.original))}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

RoutesTable.displayName = 'RoutesTable';
