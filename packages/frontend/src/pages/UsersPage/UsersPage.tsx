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
import { Users, Plus, Pencil, Trash2, Shield, Loader2, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/shared/ui';
import { useGetUsersQuery, useGetRolesQuery, useDeleteUserMutation } from '@/shared/api/api';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Администратор',
  2: 'Оператор',
  3: 'Супервизор',
  5: 'Readonly',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-red-400 bg-red-400/10',
  2: 'text-blue-400 bg-blue-400/10',
  3: 'text-purple-400 bg-purple-400/10',
  5: 'text-gray-400 bg-gray-400/10',
};

export const UsersPage = () => {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const [deleteUser] = useDeleteUserMutation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const rolesMap = useMemo(() => {
    const map: Record<number, string> = {};
    roles.forEach((r: any) => { map[r.id] = r.name; });
    return map;
  }, [roles]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'login',
      header: t('auth.loginPlaceholder'),
      cell: (info) => (
        <span className="font-medium text-white">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('peers.name'),
    },
    {
      accessorKey: 'exten',
      header: t('peers.exten'),
      cell: (info) => (
        <span className="text-primary font-mono">{(info.getValue() as string) || '—'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info) => (info.getValue() as string) || '—',
    },
    {
      accessorKey: 'level',
      header: 'Уровень',
      cell: (info) => {
        const level = info.getValue() as number;
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${LEVEL_COLORS[level] || 'text-gray-400 bg-gray-400/10'}`}>
            {LEVEL_LABELS[level] || `Level ${level}`}
          </span>
        );
      },
    },
    {
      accessorKey: 'role',
      header: t('nav.roles' as any) || 'Роль',
      cell: (info) => {
        const roleId = info.getValue() as number;
        return rolesMap[roleId] || '—';
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: (info) => (
        <div className="flex items-center gap-1">
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
              if (confirm(`Удалить пользователя ${info.row.original.login}?`)) {
                deleteUser(info.row.original.uniqueid);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], [t, rolesMap, deleteUser]);

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" />
            {t('nav.users')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление пользователями и правами доступа
          </p>
        </div>
        <Button id="add-user-btn" className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить
        </Button>
      </div>

      {/* Table card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {users.length} {users.length === 1 ? 'пользователь' : 'пользователей'}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="users-search"
                  placeholder={t('common.search')}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
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
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none transition-colors"
                          >
                            <div className="flex items-center gap-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getIsSorted() === 'asc' && ' ↑'}
                              {header.column.getIsSorted() === 'desc' && ' ↓'}
                            </div>
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
      </motion.div>
    </div>
  );
};
