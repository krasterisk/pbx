import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteDirectoryMutation } from '@/shared/api/endpoints/directoryApi';
import { directoriesActions } from '../../model/slice/directoriesSlice';
import type { IDirectory } from '@krasterisk/shared';
import cls from './DirectoriesTable.module.scss';

const columnHelper = createColumnHelper<IDirectory>();

export const useDirectoriesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteDirectory] = useDeleteDirectoryMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('directories.name'),
        cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor('description', {
        header: () => t('directories.description'),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || t('directories.noDescription')}
          </Text>
        ),
      }),

      columnHelper.accessor((row) => row.fields?.length ?? 0, {
        id: 'fieldsCount',
        header: () => t('directories.fieldsCount'),
        cell: (info) => <Text as="span" className={cls.muted}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor((row) => row.records?.length ?? 0, {
        id: 'recordsCount',
        header: () => t('directories.recordsCount'),
        cell: (info) => <Text as="span" className={cls.muted}>{info.getValue()}</Text>,
      }),

      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const item = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(directoriesActions.openEditModal(item))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(directoriesActions.openCopyModal(item))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => {
                  if (window.confirm(t('directories.confirmDelete'))) {
                    void deleteDirectory(item.uid);
                  }
                }}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, deleteDirectory],
  );
};
