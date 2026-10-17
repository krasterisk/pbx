import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, HStack, Input, Label, SegmentedControl } from '@/shared/ui';
import {
  REPORT_PERIOD_PRESETS,
  canShiftForward,
  detectPreset,
  presetRange,
  shiftRange,
  type DateRange,
  type ReportPeriodPreset,
} from '../../lib/reportPeriod';
import { formatCcDateRange } from '../../lib/ccFormat';
import styles from './ReportPeriodBar.module.scss';

export interface ReportPeriodBarProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Report works on one day (agent timeline): a single date field, no ranges. */
  singleDay?: boolean;
  /** Overridable for tests. */
  today?: string;
  locale?: 'ru' | 'en';
}

/**
 * Report period (U3.1): the dashboard presets, back / forward by the length of the range and a custom
 * range. A link with arbitrary dates simply reads as "custom".
 */
export function ReportPeriodBar({ value, onChange, singleDay = false, today, locale = 'ru' }: ReportPeriodBarProps) {
  const { t } = useTranslation();

  if (singleDay) {
    return (
      <div className={styles.field}>
        <Label htmlFor="cc-report-date">{t('callcenter.reports.filters.dateFrom', 'From')}</Label>
        <Input
          id="cc-report-date"
          type="date"
          value={value.from}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: e.target.value })}
        />
      </div>
    );
  }

  const preset = detectPreset(value, today);
  const options = REPORT_PERIOD_PRESETS.map((p) => ({
    value: p,
    label: t(`callcenter.dashboard.period.${p}`, p),
  }));

  const select = (next: ReportPeriodPreset) => {
    if (next === 'custom') return onChange({ ...value });
    onChange(presetRange(next, today));
  };

  return (
    <div className={styles.bar} data-testid="cc-report-period">
      <HStack gap="8" align="center" wrap="wrap">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('callcenter.reports.periodPrev', 'Previous period')}
          onClick={() => onChange(shiftRange(value, -1))}
          data-testid="cc-report-period-prev"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className={styles.label} data-testid="cc-report-period-label" aria-live="polite">
          {formatCcDateRange(value.from, value.to, locale)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('callcenter.reports.periodNext', 'Next period')}
          disabled={!canShiftForward(value, today)}
          onClick={() => onChange(shiftRange(value, 1))}
          data-testid="cc-report-period-next"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
        <SegmentedControl<ReportPeriodPreset>
          options={options}
          value={preset}
          onChange={select}
          ariaLabel={t('callcenter.dashboard.periodLabel', 'Period')}
          className={styles.presets}
        />
      </HStack>
      {preset === 'custom' ? (
        <HStack gap="8" align="end" wrap="wrap" className={styles.custom}>
          <div className={styles.field}>
            <Label htmlFor="cc-report-from">{t('callcenter.reports.filters.dateFrom', 'From')}</Label>
            <Input
              id="cc-report-from"
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to })}
            />
          </div>
          <div className={styles.field}>
            <Label htmlFor="cc-report-to">{t('callcenter.reports.filters.dateTo', 'To')}</Label>
            <Input
              id="cc-report-to"
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => e.target.value && onChange({ from: value.from, to: e.target.value })}
            />
          </div>
        </HStack>
      ) : null}
    </div>
  );
}
