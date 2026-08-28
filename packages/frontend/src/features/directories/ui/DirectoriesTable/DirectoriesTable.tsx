import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Copy, Pencil, Trash2 } from 'lucide-react';
import type { IDirectory } from '@krasterisk/shared';
import {
  Card,
  Text,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableRowActions,
  TableRowAction,
  Skeleton,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useDeleteDirectoryMutation, useGetDirectoriesQuery } from '@/shared/api/endpoints/directoryApi';
import { directoriesActions } from '../../model/slice/directoriesSlice';
import cls from './DirectoriesTable.module.scss';

export const DirectoriesTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: directories, isLoading } = useGetDirectoriesQuery();
  const [deleteDirectory] = useDeleteDirectoryMutation();

  const handleEdit = useCallback((item: IDirectory) => {
    dispatch(directoriesActions.openEditModal(item));
  }, [dispatch]);

  const handleCopy = useCallback((item: IDirectory) => {
    dispatch(directoriesActions.openCopyModal(item));
  }, [dispatch]);

  const handleDelete = useCallback(async (item: IDirectory) => {
    const confirmed = window.confirm(
      t('directories.confirmDelete', 'Delete this directory?'),
    );
    if (confirmed) {
      await deleteDirectory(item.uid);
    }
  }, [deleteDirectory, t]);

  if (isLoading) {
    return (
      <Card className={cls.card}>
        <VStack gap="8" className={cls.loading}>
          <Skeleton className={cls.skeletonRow} />
          <Skeleton className={cls.skeletonRow} />
          <Skeleton className={cls.skeletonRow} />
        </VStack>
      </Card>
    );
  }

  if (!directories?.length) {
    return (
      <Card className={cls.card}>
        <VStack gap="8" align="center" className={cls.emptyState}>
          <BookMarked className={cls.emptyIcon} />
          <Text className={cls.emptyTitle}>{t('directories.empty', 'No directories')}</Text>
          <Text variant="muted">{t('directories.emptyHint', 'Create a directory with a schema and records.')}</Text>
        </VStack>
      </Card>
    );
  }

  return (
    <Card className={cls.card}>
      <Table className={cls.table}>
        <TableHeader>
          <TableRow className={cls.headRow}>
            <TableHead className={cls.headCell}>{t('directories.name', 'Name')}</TableHead>
            <TableHead className={cls.headCell}>{t('directories.description', 'Description')}</TableHead>
            <TableHead className={cls.headCell}>{t('directories.fieldsCount', 'Fields')}</TableHead>
            <TableHead className={cls.headCell}>{t('directories.recordsCount', 'Records')}</TableHead>
            <TableHead className={cls.actionsCell}>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {directories.map((item) => (
            <TableRow
              key={item.uid}
              className={cls.bodyRow}
              onClick={() => handleEdit(item)}
            >
              <TableCell>
                <Text className={cls.name}>{item.name}</Text>
              </TableCell>
              <TableCell>
                <Text variant="muted">{item.description || t('directories.noDescription', 'None')}</Text>
              </TableCell>
              <TableCell>
                <Text variant="muted">{item.fields?.length ?? 0}</Text>
              </TableCell>
              <TableCell>
                <Text variant="muted">{item.records?.length ?? 0}</Text>
              </TableCell>
              <TableCell className={cls.actionsCell} onClick={(e) => e.stopPropagation()}>
                <HStack justify="end">
                  <TableRowActions>
                    <TableRowAction
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil />
                    </TableRowAction>
                    <TableRowAction
                      title={t('common.copy')}
                      aria-label={t('common.copy')}
                      onClick={() => handleCopy(item)}
                    >
                      <Copy />
                    </TableRowAction>
                    <TableRowAction
                      danger
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 />
                    </TableRowAction>
                  </TableRowActions>
                </HStack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
});

DirectoriesTable.displayName = 'DirectoriesTable';
