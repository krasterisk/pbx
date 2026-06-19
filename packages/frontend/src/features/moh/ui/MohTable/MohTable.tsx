import { memo, useCallback, useMemo, useState } from 'react';
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
import {
  Button,
  Skeleton,
  Text,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetMohClassesQuery, useDeleteMohClassMutation } from '@/shared/api/endpoints/mohApi';
import { mohActions } from '../../model/slice/mohSlice';
import { MohFormModal } from '../MohFormModal/MohFormModal';
import type { IMohClass } from '@/entities/moh';
import cls from './MohTable.module.scss';

const columnHelper = createColumnHelper<IMohClass>();
const SKELETON_ROWS = [1, 2, 3, 4, 5];

export const MohTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: mohClasses = [], isLoading } = useGetMohClassesQuery();
  const [deleteMoh] = useDeleteMohClassMutation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const handleDelete = useCallback(
    (moh: IMohClass) => {
      const confirmed = window.confirm(
        t('moh.confirmDelete', 'Удалить класс «{{name}}»?').replace('{{name}}', moh.displayName),
      );
      if (confirmed) {
        deleteMoh(moh.name);
      }
    },
    [t, deleteMoh],
  );

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'index',
      header: '№',
      size: 50,
      cell: (info) => (
        <Text variant="small">{info.row.index + 1}</Text>
      ),
    }),
    columnHelper.accessor('displayName', {
      header: t('moh.table.name', 'Название'),
      cell: (info) => (
        <HStack gap="8" align="center">
          <Music size={16} className={cls.musicIcon} />
          <Text className={cls.className}>{info.getValue()}</Text>
        </HStack>
      ),
    }),
    columnHelper.accessor((row) => row.entries?.length || 0, {
      id: 'tracks',
      header: t('moh.table.tracks', 'Треков'),
      size: 100,
      cell: (info) => (
        <Text as="span" variant="small" className={cls.tracksBadge}>
          {info.getValue()}
        </Text>
      ),
    }),
    columnHelper.accessor('sort', {
      header: t('moh.table.sort', 'Сортировка'),
      size: 140,
      cell: (info) => {
        const val = info.getValue();
        const sortClass = val === 'random' ? cls.sort_random : val === 'alpha' ? cls.sort_alpha : '';
        return (
          <Text as="span" variant="small" className={`${cls.sortBadge} ${sortClass}`}>
            {val === 'random'
              ? t('moh.sort.random', 'Случайно')
              : val === 'alpha'
                ? t('moh.sort.alpha', 'По порядку')
                : val}
          </Text>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: t('common.actions', 'Действия'),
      size: 100,
      cell: (info) => (
        <HStack gap="4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dispatch(mohActions.openEditModal(info.row.original))}
            title={t('common.edit', 'Редактировать')}
          >
            <Pencil className={cls.actionIcon} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cls.actionBtnDelete}
            onClick={() => handleDelete(info.row.original)}
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 className={cls.actionIcon} />
          </Button>
        </HStack>
      ),
    }),
  ], [t, dispatch, handleDelete]);

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

  const renderHeader = () => (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className={cls.tableHeadRow}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              style={{ width: header.getSize() }}
              className={cls.headCell}
              onClick={header.column.getToggleSortingHandler()}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );

  if (isLoading) {
    return (
      <>
        <div className={cls.tableWrap}>
          <Table className={cls.table}>
            <TableHeader>
              <TableRow className={cls.tableHeadRow}>
                <TableHead className={cls.headCell}>№</TableHead>
                <TableHead className={cls.headCell}>{t('moh.table.name', 'Название')}</TableHead>
                <TableHead className={cls.headCell}>{t('moh.table.tracks', 'Треков')}</TableHead>
                <TableHead className={cls.headCell}>{t('moh.table.sort', 'Сортировка')}</TableHead>
                <TableHead className={cls.headCell}>{t('common.actions', 'Действия')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SKELETON_ROWS.map((i) => (
                <TableRow key={i} className={cls.bodyRow}>
                  <TableCell><Skeleton className={cls.skeletonSm} /></TableCell>
                  <TableCell><Skeleton className={cls.skeletonMd} /></TableCell>
                  <TableCell><Skeleton className={cls.skeletonBadge} /></TableCell>
                  <TableCell><Skeleton className={cls.skeletonChip} /></TableCell>
                  <TableCell><Skeleton className={cls.skeletonActions} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <MohFormModal />
      </>
    );
  }

  return (
    <>
      <div className={cls.tableWrap}>
        <Table className={cls.table}>
          {renderHeader()}
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className={cls.emptyCell}>
                  <VStack align="center" gap="8">
                    <Music size={36} className={cls.emptyIcon} />
                    <Text className={cls.emptyTitle}>
                      {t('moh.empty.title', 'Нет классов Music On Hold')}
                    </Text>
                    <Text variant="muted" className={cls.emptyHint}>
                      {t(
                        'moh.empty.hint',
                        'Нажмите «Создать класс», чтобы добавить первый плейлист',
                      )}
                    </Text>
                  </VStack>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cls.bodyRow}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MohFormModal />
    </>
  );
});

MohTable.displayName = 'MohTable';
