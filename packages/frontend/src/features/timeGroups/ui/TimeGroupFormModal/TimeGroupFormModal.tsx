import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Text, Select, Label } from '@/shared/ui';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateTimeGroupMutation,
  useUpdateTimeGroupMutation,
} from '@/shared/api/endpoints/timeGroupApi';
import { timeGroupsActions } from '../../model/slice/timeGroupsSlice';
import { getTimeGroupsEditingItem, getTimeGroupsModalMode } from '../../model/selectors/timeGroupsSelectors';
import type { ITimeGroupInterval } from '@krasterisk/shared';
import cls from './TimeGroupFormModal.module.scss';

const WEEKDAYS = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
] as const;

const MONTHS = [
  { key: 'jan', label: 'Январь' },
  { key: 'feb', label: 'Февраль' },
  { key: 'mar', label: 'Март' },
  { key: 'apr', label: 'Апрель' },
  { key: 'may', label: 'Май' },
  { key: 'jun', label: 'Июнь' },
  { key: 'jul', label: 'Июль' },
  { key: 'aug', label: 'Август' },
  { key: 'sep', label: 'Сентябрь' },
  { key: 'oct', label: 'Октябрь' },
  { key: 'nov', label: 'Ноябрь' },
  { key: 'dec', label: 'Декабрь' },
] as const;

const DEFAULT_INTERVAL: ITimeGroupInterval = {
  time_start: '09:00',
  time_end: '18:00',
  days_of_week: '*',
  days_of_month: '*',
  months: '*',
};

/** Parse days_of_week string into Set of keys */
function parseDaysOfWeek(value: string): Set<string> {
  if (!value || value === '*') return new Set<string>();
  const result = new Set<string>();
  const allKeys: string[] = WEEKDAYS.map(w => w.key);
  const parts = value.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      const si = allKeys.indexOf(start.trim());
      const ei = allKeys.indexOf(end.trim());
      if (si >= 0 && ei >= 0) {
        for (let i = si; i <= ei; i++) result.add(allKeys[i]);
      }
    } else {
      result.add(part.trim());
    }
  }
  return result;
}

/** Convert Set of day keys back to Asterisk format */
function daysToString(days: Set<string>): string {
  if (days.size === 0 || days.size === 7) return '*';
  const allKeys: string[] = WEEKDAYS.map(w => w.key);
  const selected = allKeys.filter(k => days.has(k));

  let isContiguous = true;
  for (let i = 1; i < selected.length; i++) {
    if (allKeys.indexOf(selected[i]) !== allKeys.indexOf(selected[i - 1]) + 1) {
      isContiguous = false;
      break;
    }
  }
  if (isContiguous && selected.length > 1) {
    return `${selected[0]}-${selected[selected.length - 1]}`;
  }
  return selected.join(',');
}

interface IntervalEditorProps {
  interval: ITimeGroupInterval;
  index: number;
  onChange: (index: number, interval: ITimeGroupInterval) => void;
  onRemove: (index: number) => void;
}

const IntervalEditor = memo(({ interval, index, onChange, onRemove }: IntervalEditorProps) => {
  const { t } = useTranslation();
  const selectedDays = parseDaysOfWeek(interval.days_of_week);

  const toggleDay = (day: string) => {
    const next = new Set(selectedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange(index, { ...interval, days_of_week: daysToString(next) });
  };

  const handleField = (field: keyof ITimeGroupInterval, value: string) => {
    onChange(index, { ...interval, [field]: value });
  };

  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <VStack className={cls.intervalCard}>
      <HStack justify="between" align="center" className={cls.intervalHeader}>
        <Text variant="muted" className={cls.intervalLabel}>
          {t('timeGroups.interval', 'Интервал')} {index + 1}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          title={t('timeGroups.removeInterval', 'Удалить интервал')}
          className={cls.removeIntervalBtn}
        >
          <Trash2 className={cls.removeIntervalIcon} />
        </Button>
      </HStack>

      {/* Time range */}
      <HStack gap="8" align="center" className={cls.timeGrid}>
        <Label>{t('timeGroups.timeFrom', 'С')}</Label>
        <Input
          type="time"
          value={interval.time_start}
          onChange={(e) => handleField('time_start', e.target.value)}
        />
        <Label>{t('timeGroups.timeTo', 'По')}</Label>
        <Input
          type="time"
          value={interval.time_end}
          onChange={(e) => handleField('time_end', e.target.value)}
        />
      </HStack>

      {/* Days of week - toggle buttons */}
      <VStack className={cls.dowContainer}>
        <Text variant="muted" className={cls.fieldLabel}>
          {t('timeGroups.daysOfWeek', 'Дни недели')}
          {interval.days_of_week === '*' && (
            <Text as="span" className={cls.allDaysHint}>
              ({t('timeGroups.allDays', 'все')})
            </Text>
          )}
        </Text>
        <HStack className={cls.dowButtons}>
          {WEEKDAYS.map((wd) => {
            const isSelected = selectedDays.has(wd.key);
            return (
              <Button
                key={wd.key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleDay(wd.key)}
                className={isSelected ? cls.dowBtnActive : cls.dowBtn}
              >
                {wd.label}
              </Button>
            );
          })}
        </HStack>
      </VStack>

      {/* Day of month + Month */}
      <HStack className={cls.selectGrid}>
        <VStack>
          <Label className={cls.fieldLabel}>
            {t('timeGroups.dayOfMonth', 'День месяца')}
          </Label>
          <Select
            value={interval.days_of_month}
            onChange={(e) => handleField('days_of_month', e.target.value)}
          >
            <option value="*">{t('timeGroups.anyDay', 'Любой')}</option>
            {dayOptions.map(d => (
              <option key={d} value={String(d)}>{d}</option>
            ))}
          </Select>
        </VStack>
        <VStack>
          <Label className={cls.fieldLabel}>
            {t('timeGroups.month', 'Месяц')}
          </Label>
          <Select
            value={interval.months}
            onChange={(e) => handleField('months', e.target.value)}
          >
            <option value="*">{t('timeGroups.anyMonth', 'Любой')}</option>
            {MONTHS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </VStack>
      </HStack>
    </VStack>
  );
});
IntervalEditor.displayName = 'IntervalEditor';


export const TimeGroupFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const editingItem = useAppSelector(getTimeGroupsEditingItem);
  const mode = useAppSelector(getTimeGroupsModalMode);

  const isCreateMode = mode === 'create' || mode === 'copy';

  const [name, setName] = useState(
    mode === 'copy' ? '' : (editingItem?.name || '')
  );
  const [comment, setComment] = useState(editingItem?.comment || '');
  const [intervals, setIntervals] = useState<ITimeGroupInterval[]>(
    editingItem?.intervals?.length ? editingItem.intervals : [{ ...DEFAULT_INTERVAL }],
  );

  const [createTimeGroup, { isLoading: isCreating }] = useCreateTimeGroupMutation();
  const [updateTimeGroup, { isLoading: isUpdating }] = useUpdateTimeGroupMutation();

  const handleClose = useCallback(() => {
    dispatch(timeGroupsActions.closeModal());
  }, [dispatch]);

  const handleIntervalChange = useCallback((index: number, interval: ITimeGroupInterval) => {
    setIntervals(prev => prev.map((item, i) => i === index ? interval : item));
  }, []);

  const handleIntervalRemove = useCallback((index: number) => {
    setIntervals(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddInterval = useCallback(() => {
    setIntervals(prev => [...prev, { ...DEFAULT_INTERVAL }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      comment: comment.trim(),
      intervals,
    };

    try {
      if (!isCreateMode && editingItem) {
        await updateTimeGroup({ uid: editingItem!.uid, data: payload }).unwrap();
      } else {
        await createTimeGroup(payload).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save time group:', err);
    }
  }, [name, comment, intervals, isCreateMode, editingItem, createTimeGroup, updateTimeGroup, handleClose]);

  const isSaving = isCreating || isUpdating;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? t('timeGroups.editTitle', 'Редактировать временную группу')
              : mode === 'copy'
                ? t('timeGroups.copyTitle', 'Копировать временную группу')
                : t('timeGroups.createTitle', 'Новая временная группа')
            }
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          {/* Name & Comment */}
          <HStack className={cls.formGrid}>
            <VStack>
              <Label className={cls.fieldLabel}>
                {t('timeGroups.name', 'Название')} *
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('timeGroups.namePlaceholder', 'Рабочее время')}
                autoFocus
              />
            </VStack>
            <VStack>
              <Label className={cls.fieldLabel}>
                {t('timeGroups.comment', 'Описание')}
              </Label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('timeGroups.commentPlaceholder', 'Пн-Пт 9:00–18:00')}
              />
            </VStack>
          </HStack>

          {/* Intervals */}
          <VStack gap="8">
            <Text variant="muted" className={cls.intervalLabel}>
              {t('timeGroups.intervalsLabel', 'Интервалы времени')}
            </Text>
            {intervals.map((interval, i) => (
              <IntervalEditor
                key={i}
                interval={interval}
                index={i}
                onChange={handleIntervalChange}
                onRemove={handleIntervalRemove}
              />
            ))}
            <Button variant="outline" size="sm" onClick={handleAddInterval}>
              <Plus className={cls.removeIntervalIcon} />
              {t('timeGroups.addInterval', 'Добавить интервал')}
            </Button>
          </VStack>
        </VStack>

        {/* Actions */}
        <DialogFooter className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            {isSaving
              ? t('common.saving', 'Сохранение...')
              : t('common.save', 'Сохранить')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

TimeGroupFormModal.displayName = 'TimeGroupFormModal';
