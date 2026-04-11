import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { List, Plus, Pencil, Trash2, Loader2, Search, Hash } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetNumbersQuery, useDeleteNumberMutation } from '@/shared/api/api';

export const NumbersPage = () => {
  const { t } = useTranslation();
  const { data: numbers = [], isLoading } = useGetNumbersQuery();
  const [deleteNumber] = useDeleteNumberMutation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Название списка',
      cell: (info) => <span className="font-medium text-white">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'comment',
      header: 'Комментарий',
      cell: (info) => (info.getValue() as string) || '—',
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => (
        <HStack gap="4">
          <button
            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
            title={t('common.edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title={t('common.delete')}
            onClick={() => {
              if (confirm(`Удалить список ${info.row.original.name}?`)) {
                deleteNumber(info.row.original.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </HStack>
      ),
    },
  ], [t, deleteNumber]);

  const table = useReactTable({
    data: numbers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <List className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">
              {(t('nav.numbers' as any) || 'Списки доступа')}
            </h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            Настройка списков видимости очередей, абонентов и маршрутов
          </p>
        </VStack>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
              <HStack gap="8" align="center">
                <Hash className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">
                  {numbers.length} {t('nav.numbers')}
                </span>
              </HStack>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
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
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
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
                        <tr key={row.id} className="border-b border-border/50 hover:bg-white/[0.02]">
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
      </motion.div>
    </VStack>
  );
};
