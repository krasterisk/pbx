import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { Phone, Search, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Input } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import { useEndpointsTableColumns } from './useEndpointsTableColumns';

export const EndpointsTable = memo(() => {
  const { t } = useTranslation();
  const { data: endpoints = [], isLoading } = useGetEndpointsQuery();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useEndpointsTableColumns();

  const table = useReactTable({
    data: endpoints as IEndpointListItem[],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onlineCount = endpoints.filter((e) => e.status === 'online').length;

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <Phone className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('endpoints.count', { count: endpoints.length })}
            </span>
            {endpoints.length > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                {onlineCount} {t('endpoints.statusOnline').toLowerCase()}
              </span>
            )}
          </HStack>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="endpoints-search"
              placeholder={t('common.search')}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        </HStack>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
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
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
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

EndpointsTable.displayName = 'EndpointsTable';
