import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { Pencil, Trash2, Music } from 'lucide-react';
import { Card } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetMohClassesQuery, useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { mohActions } from '../../model/slice/mohSlice';
import { MohFormModal } from '../MohFormModal/MohFormModal';
import type { IMohClass } from '@/entities/moh';
import cls from './MohTable.module.scss';

const columnHelper = createColumnHelper<IMohClass>();

export const MohTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: mohClasses = [], isLoading } = useGetMohClassesQuery();
  const [deleteMoh] = useDeleteMohClassMutation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'index',
      header: '№',
      size: 50,
      cell: (info) => info.row.index + 1,
    }),
    columnHelper.accessor('displayName', {
      header: t('moh.table.name', 'Название'),
      cell: (info) => (
        <HStack gap="8" align="center">
          <Music size={16} className={cls.musicIcon} />
          <span className={cls.className}>{info.getValue()}</span>
        </HStack>
      ),
    }),
    columnHelper.accessor((row) => row.entries?.length || 0, {
      id: 'tracks',
      header: t('moh.table.tracks', 'Треков'),
      size: 100,
      cell: (info) => (
        <span className={cls.tracksBadge}>{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('sort', {
      header: t('moh.table.sort', 'Сортировка'),
      size: 140,
      cell: (info) => {
        const val = info.getValue();
        return (
          <span className={`${cls.sortBadge} ${cls[`sort_${val}`] || ''}`}>
            {val === 'random'
              ? t('moh.sort.random', 'Случайно')
              : val === 'alpha'
                ? t('moh.sort.alpha', 'По порядку')
                : val}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: t('common.actions', 'Действия'),
      size: 100,
      cell: (info) => (
        <HStack gap="4">
          <button
            className={cls.actionBtn}
            onClick={() => dispatch(mohActions.openEditModal(info.row.original))}
            title={t('common.edit', 'Редактировать')}
          >
            <Pencil size={15} />
          </button>
          <button
            className={`${cls.actionBtn} ${cls.deleteBtn}`}
            onClick={() => handleDelete(info.row.original)}
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 size={15} />
          </button>
        </HStack>
      ),
    }),
  ], [t, dispatch]);

  const table = useReactTable({
    data: mohClasses,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleDelete = (moh: IMohClass) => {
    const confirmed = window.confirm(
      t('moh.confirmDelete', 'Удалить класс «{{name}}»?').replace('{{name}}', moh.displayName),
    );
    if (confirmed) {
      deleteMoh(moh.name);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className={cls.loading}>{t('common.loading', 'Загрузка...')}</div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className={cls.tableWrapper}>
          <table className={cls.table}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cls.th}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className={cls.emptyRow}>
                    <VStack align="center" gap="8">
                      <Music size={36} className={cls.emptyIcon} />
                      <span>{t('common.noData', 'Нет данных')}</span>
                    </VStack>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={cls.row}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={cls.td}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <MohFormModal />
    </>
  );
});

MohTable.displayName = 'MohTable';
