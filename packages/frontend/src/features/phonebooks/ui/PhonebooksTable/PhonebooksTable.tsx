import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Pencil, Copy, BookOpen } from 'lucide-react';
import { Button, Text, Card, Checkbox, Tooltip } from '@/shared/ui';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/shared/ui/Table/Table';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetPhonebooksQuery,
  useDeletePhonebookMutation,
  useBulkDeletePhonebooksMutation,
} from '@/shared/api/endpoints/phonebookApi';
import { phonebooksActions } from '../../model/slice/phonebooksSlice';
import { getPhonebooksSelectedIds } from '../../model/selectors/phonebooksSelectors';
import type { IRoutePhonebook } from '@krasterisk/shared';
import cls from './PhonebooksTable.module.scss';

export const PhonebooksTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: phonebooks, isLoading } = useGetPhonebooksQuery();
  const [deletePhonebook] = useDeletePhonebookMutation();
  const [bulkDelete] = useBulkDeletePhonebooksMutation();
  const selectedIds = useAppSelector(getPhonebooksSelectedIds);

  const handleEdit = useCallback((pb: IRoutePhonebook) => {
    dispatch(phonebooksActions.openEditModal(pb));
  }, [dispatch]);

  const handleCopy = useCallback((pb: IRoutePhonebook) => {
    dispatch(phonebooksActions.openCopyModal(pb));
  }, [dispatch]);

  const handleDelete = useCallback(async (uid: number) => {
    if (window.confirm(t('phonebooks.confirmDelete', 'Удалить справочник?'))) {
      await deletePhonebook(uid);
    }
  }, [deletePhonebook, t]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length && window.confirm(t('phonebooks.confirmBulkDelete', 'Удалить выбранные?'))) {
      await bulkDelete(selectedIds);
      dispatch(phonebooksActions.clearSelection());
    }
  }, [selectedIds, bulkDelete, dispatch, t]);

  const toggleSelect = useCallback((uid: number) => {
    const next = selectedIds.includes(uid)
      ? selectedIds.filter((id: number) => id !== uid)
      : [...selectedIds, uid];
    dispatch(phonebooksActions.setSelectedIds(next));
  }, [selectedIds, dispatch]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
      </Card>
    );
  }

  if (!phonebooks?.length) {
    return (
      <Card className="p-8">
        <VStack gap="8" align="center" className={cls.emptyState}>
          <BookOpen className={cls.emptyIcon} />
          <Text variant="muted">{t('phonebooks.empty', 'Нет справочников')}</Text>
        </VStack>
      </Card>
    );
  }

  return (
    <>
      {selectedIds.length > 0 && (
        <HStack gap="8" align="center" className={cls.bulkActions}>
          <Text variant="muted">
            {t('common.selected', 'Выбрано')}: {selectedIds.length}
          </Text>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className={cls.actionIcon} />
            {t('common.deleteSelected', 'Удалить выбранные')}
          </Button>
        </HStack>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={cls.checkboxCell}>
                <Checkbox
                  checked={selectedIds.length === phonebooks.length && phonebooks.length > 0}
                  onChange={() => {
                    if (selectedIds.length === phonebooks.length) {
                      dispatch(phonebooksActions.clearSelection());
                    } else {
                      dispatch(phonebooksActions.setSelectedIds(phonebooks.map(pb => pb.uid)));
                    }
                  }}
                />
              </TableHead>
              <TableHead>{t('phonebooks.name', 'Название')}</TableHead>
              <TableHead>{t('phonebooks.description', 'Описание')}</TableHead>
              <TableHead>{t('phonebooks.mode', 'Режим')}</TableHead>
              <TableHead>{t('phonebooks.entries', 'Номера')}</TableHead>
              <TableHead>{t('phonebooks.actionsCount', 'Действия')}</TableHead>
              <TableHead className={cls.actionsCell}>{t('common.actions', 'Действия')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phonebooks.map((pb) => (
              <TableRow
                key={pb.uid}
                onClick={() => handleEdit(pb)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(pb.uid)}
                    onChange={() => toggleSelect(pb.uid)}
                  />
                </TableCell>
                <TableCell>
                  <Text className="font-medium">{pb.name}</Text>
                </TableCell>
                <TableCell>
                  <Text variant="muted">{pb.description || '—'}</Text>
                </TableCell>
                <TableCell>
                  <Text className={pb.invert ? cls.badgeInvert : cls.badgeNormal}>
                    {pb.invert
                      ? t('phonebooks.invertMode', 'Инвертирован')
                      : t('phonebooks.normalMode', 'Обычный')
                    }
                  </Text>
                </TableCell>
                <TableCell>
                  <Text variant="muted" className={cls.entriesCount}>
                    {(pb as any).entries?.length ?? 0}
                  </Text>
                </TableCell>
                <TableCell>
                  <Text variant="muted" className={cls.entriesCount}>
                    {pb.actions?.length ?? 0}
                  </Text>
                </TableCell>
                <TableCell className={cls.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <HStack gap="4" justify="end">
                    <Tooltip content={t('common.edit', 'Редактировать')}>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(pb)}>
                        <Pencil className={cls.actionIcon} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('common.copy', 'Копировать')}>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(pb)}>
                        <Copy className={cls.actionIcon} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('common.delete', 'Удалить')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pb.uid)}
                        className={cls.actionBtnDelete}
                      >
                        <Trash2 className={cls.actionIcon} />
                      </Button>
                    </Tooltip>
                  </HStack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
});

PhonebooksTable.displayName = 'PhonebooksTable';
