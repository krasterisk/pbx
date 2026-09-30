import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Input, Label, SegmentedControl } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import {
  canShiftForward,
  currentPeriod,
  formatPeriodLabel,
  resolvePeriod,
  shiftPeriod,
  type PeriodSelection,
  type PeriodUnit,
} from './periodRange';

export interface PeriodNavigatorProps {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  className?: string;
}

export function PeriodNavigator({ value, onChange, className }: PeriodNavigatorProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language?.startsWith('en') ? 'en' : 'ru';
  const units: Array<{ value: PeriodUnit; label: string }> = [
    { value: 'day', label: t('period.day', 'День') },
    { value: 'week', label: t('period.week', 'Неделя') },
    { value: 'month', label: t('period.month', 'Месяц') },
    { value: 'year', label: t('period.year', 'Год') },
    { value: 'custom', label: t('period.custom', 'Период') },
  ];
  const label = formatPeriodLabel(value, locale);

  return (
    <HStack gap="8" align="center" className={className} data-testid="period-navigator">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('period.prev', 'Предыдущий период')}
        onClick={() => onChange(shiftPeriod(value, -1))}
      >
        <ChevronLeft size={16} />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-medium" data-testid="period-label">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('period.next', 'Следующий период')}
        disabled={!canShiftForward(value)}
        onClick={() => onChange(shiftPeriod(value, 1))}
      >
        <ChevronRight size={16} />
      </Button>
      <SegmentedControl
        ariaLabel={t('period.unit', 'Период')}
        value={value.unit}
        onChange={(unit) => {
          if (unit === 'custom') {
            const resolved = resolvePeriod(value);
            onChange({
              unit: 'custom',
              anchor: resolved.startDate,
              customFrom: resolved.startDate,
              customTo: resolved.endDate,
            });
            return;
          }
          onChange(currentPeriod(unit));
        }}
        options={units.map((unit) => ({ value: unit.value, label: unit.label }))}
      />
      {value.unit === 'custom' ? (
        <HStack gap="8" align="center">
          <Label htmlFor="period-from">{t('period.from', 'С')}</Label>
          <Input
            id="period-from"
            type="date"
            value={value.customFrom ?? ''}
            onChange={(event) => onChange({ ...value, customFrom: event.target.value })}
          />
          <Label htmlFor="period-to">{t('period.to', 'По')}</Label>
          <Input
            id="period-to"
            type="date"
            value={value.customTo ?? ''}
            onChange={(event) => onChange({ ...value, customTo: event.target.value })}
          />
        </HStack>
      ) : null}
    </HStack>
  );
}
