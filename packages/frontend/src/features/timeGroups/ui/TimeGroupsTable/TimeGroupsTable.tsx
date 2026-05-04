import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Pencil, Copy, Calendar } from 'lucide-react';
import { Button, Text, Card, Checkbox } from '@/shared/ui';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/shared/ui/Table/Table';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTimeGroupsQuery,
  useDeleteTimeGroupMutation,
  useBulkDeleteTimeGroupsMutation,
} from '@/shared/api/endpoints/timeGroupApi';
import { timeGroupsActions } from '../../model/slice/timeGroupsSlice';
import {
  getTimeGroupsSelectedIds,
} from '../../model/selectors/timeGroupsSelectors';
import type { ITimeGroup, ITimeGroupInterval } from '@krasterisk/shared';
import cls from './TimeGroupsTable.module.scss';

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт',
  fri: 'Пт', sat: 'Сб', sun: 'Вс',
};

const MONTH_LABELS: Record<string, string> = {
  jan: 'Янв', feb: 'Фев', mar: 'Мар', apr: 'Апр',
  may: 'Май', jun: 'Июн', jul: 'Июл', aug: 'Авг',
  sep: 'Сен', oct: 'Окт', nov: 'Ноя', dec: 'Дек',
};

function formatInterval(interval: ITimeGroupInterval): string {
  const parts: string[] = [];

  if (interval.time_start && interval.time_end) {
    parts.push(`${interval.time_start}–${interval.time_end}`);
  }

  if (interval.days_of_week && interval.days_of_week !== '*') {
    const dows = interval.days_of_week.split(/[-,]/);
    const labels = dows.map(d => WEEKDAY_LABELS[d.trim()] || d.trim()).join(
      interval.days_of_week.includes('-') ? '–' : ', '
    );
    parts.push(labels);
  }

  if (interval.days_of_month && interval.days_of_month !== '*') {
    parts.push(`${interval.days_of_month} ч.м.`);
  }

  if (interval.months && interval.months !== '*') {
    const mons = interval.months.split(/[-,]/);
    const labels = mons.map(m => MONTH_LABELS[m.trim()] || m.trim()).join(
      interval.months.includes('-') ? '–' : ', '
    );
    parts.push(labels);
  }

  return parts.join(' · ') || 'Всегда';
}

export const TimeGroupsTable = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: timeGroups, isLoading } = useGetTimeGroupsQuery();
  const [deleteTimeGroup] = useDeleteTimeGroupMutation();
  const [bulkDelete] = useBulkDeleteTimeGroupsMutation();
  const selectedIds = useAppSelector(getTimeGroupsSelectedIds);

  const handleEdit = useCallback((tg: ITimeGroup) => {
    dispatch(timeGroupsActions.openEditModal(tg));
  }, [dispatch]);

  const handleCopy = useCallback((tg: ITimeGroup) => {
    dispatch(timeGroupsActions.openCopyModal(tg));
  }, [dispatch]);

  const handleDelete = useCallback(async (uid: number) => {
    if (window.confirm(t('timeGroups.confirmDelete', 'Удалить временную группу?'))) {
      await deleteTimeGroup(uid);
    }
  }, [deleteTimeGroup, t]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length && window.confirm(t('timeGroups.confirmBulkDelete', 'Удалить выбранные?'))) {
      await bulkDelete(selectedIds);
      dispatch(timeGroupsActions.clearSelection());
    }
  }, [selectedIds, bulkDelete, dispatch, t]);

  const toggleSelect = useCallback((uid: number) => {
    const next = selectedIds.includes(uid)
      ? selectedIds.filter((id: number) => id !== uid)
      : [...selectedIds, uid];
    dispatch(timeGroupsActions.setSelectedIds(next));
  }, [selectedIds, dispatch]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
      </Card>
    );
  }

  if (!timeGroups?.length) {
    return (
      <Card className="p-8">
        <VStack gap="8" align="center" className={cls.emptyState}>
          <Calendar className={cls.emptyIcon} />
          <Text variant="muted">{t('timeGroups.empty', 'Нет временных групп')}</Text>
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
                  checked={selectedIds.length === timeGroups.length && timeGroups.length > 0}
                  onChange={() => {
                    if (selectedIds.length === timeGroups.length) {
                      dispatch(timeGroupsActions.clearSelection());
                    } else {
                      dispatch(timeGroupsActions.setSelectedIds(timeGroups.map(tg => tg.uid)));
                    }
                  }}
                />
              </TableHead>
              <TableHead>{t('timeGroups.name', 'Название')}</TableHead>
              <TableHead>{t('timeGroups.comment', 'Описание')}</TableHead>
              <TableHead>{t('timeGroups.intervals', 'Интервалы')}</TableHead>
              <TableHead className={cls.actionsCell}>{t('common.actions', 'Действия')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeGroups.map((tg) => (
              <TableRow
                key={tg.uid}
                onClick={() => handleEdit(tg)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(tg.uid)}
                    onChange={() => toggleSelect(tg.uid)}
                  />
                </TableCell>
                <TableCell>
                  <Text className="font-medium">{tg.name}</Text>
                </TableCell>
                <TableCell>
                  <Text variant="muted">{tg.comment || '—'}</Text>
                </TableCell>
                <TableCell>
                  <VStack gap="2">
                    {(tg.intervals || []).map((interval, i) => (
                      <Text key={i} variant="muted" className={cls.intervalChip}>
                        {formatInterval(interval)}
                      </Text>
                    ))}
                    {(!tg.intervals || tg.intervals.length === 0) && (
                      <Text variant="muted" className={cls.noIntervals}>
                        {t('timeGroups.noIntervals', 'Нет интервалов')}
                      </Text>
                    )}
                  </VStack>
                </TableCell>
                <TableCell className={cls.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <HStack gap="4" justify="end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tg)}
                      title={t('common.edit', 'Редактировать')}
                    >
                      <Pencil className={cls.actionIcon} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(tg)}
                      title={t('common.copy', 'Копировать')}
                    >
                      <Copy className={cls.actionIcon} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tg.uid)}
                      title={t('common.delete', 'Удалить')}
                      className={cls.actionBtnDelete}
                    >
                      <Trash2 className={cls.actionIcon} />
                    </Button>
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

TimeGroupsTable.displayName = 'TimeGroupsTable';
