import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { CcDashboardPauses } from '@krasterisk/shared';
import { Flex, Text, VStack } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { buildPausesView, formatHoursMinutes } from '../../lib/pausesView';
import { formatDelta } from '../../lib/kpiCards';
import styles from './CcPausesPanel.module.scss';

export interface CcPausesPanelProps {
  pauses: CcDashboardPauses;
  compare: boolean;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** Pause time by reason, with the paid / unpaid split. Read-only. */
export const CcPausesPanel = memo(function CcPausesPanel({ pauses, compare }: CcPausesPanelProps) {
  const { t } = useTranslation();
  const view = buildPausesView(pauses);
  const hourUnit = t('callcenter.dashboard.unit.hours', 'h');
  const minuteUnit = t('callcenter.dashboard.unit.minutes', 'min');
  const time = (sec: number) => formatHoursMinutes(sec, hourUnit, minuteUnit);
  const TrendIcon = view.delta ? TREND_ICON[view.delta.trend] : null;

  if (view.count === 0) {
    return (
      <Text variant="muted" data-testid="cc-pauses-empty">
        {t('callcenter.dashboard.pauses.empty', 'No pauses in this period')}
      </Text>
    );
  }

  return (
    <VStack gap="12" data-testid="cc-pauses">
      <Flex wrap="wrap" gap="24" align="start">
        <VStack gap="2" className={styles.stat}>
          <Text as="span" className={styles.value} data-testid="cc-pauses-total">{time(view.totalSec)}</Text>
          <Text as="span" variant="xs">{t('callcenter.dashboard.pauses.total', 'Total pause time')}</Text>
          {view.delta && TrendIcon ? (
            <Flex align="center" gap="2" className={clsx(styles.delta, styles[`delta_${view.delta.tone}`])} data-testid="cc-pauses-delta" data-tone={view.delta.tone}>
              <TrendIcon size={12} aria-hidden="true" />
              <Text as="span" variant="xs">{formatDelta(view.delta, 'relative', '')}</Text>
            </Flex>
          ) : (
            <Text as="span" variant="xs" data-testid="cc-pauses-nocompare">
              {compare ? t('callcenter.dashboard.kpi.noData', 'No data to compare') : t('callcenter.dashboard.kpi.compareOff', 'Comparison is off')}
            </Text>
          )}
        </VStack>
        <VStack gap="2" className={styles.stat}>
          <Text as="span" className={styles.value} data-testid="cc-pauses-paid">{time(view.paidSec)}</Text>
          <Text as="span" variant="xs">{t('callcenter.dashboard.pauses.paid', 'Paid')}</Text>
        </VStack>
        <VStack gap="2" className={styles.stat}>
          <Text as="span" className={clsx(styles.value, view.unpaidSec > 0 && styles.tone_warning)} data-testid="cc-pauses-unpaid">{time(view.unpaidSec)}</Text>
          <Text as="span" variant="xs">{t('callcenter.dashboard.pauses.unpaid', 'Unpaid')}</Text>
        </VStack>
        {view.unknownSec > 0 && (
          <VStack gap="2" className={styles.stat}>
            <Text as="span" className={styles.value} data-testid="cc-pauses-unknown">{time(view.unknownSec)}</Text>
            <Text as="span" variant="xs">{t('callcenter.dashboard.pauses.unknown', 'Reason not in the catalog')}</Text>
          </VStack>
        )}
      </Flex>

      <VStack gap="6" data-testid="cc-pauses-reasons">
        <Text variant="xs">{t('callcenter.dashboard.pauses.byReason', 'By reason')}</Text>
        {view.rows.map((row, index) => {
          const label = row.isOther
            ? t('callcenter.dashboard.pauses.other', 'Other')
            : row.reason === '(none)'
              ? t('callcenter.dashboard.pauses.noReason', 'No reason given')
              : row.reason;
          return (
            <Flex key={row.isOther ? 'other' : row.reason} align="center" gap="8" className={styles.row} data-testid={`cc-pauses-row-${index}`}>
              <Text as="span" variant="xs" className={styles.rowLabel} title={label}>{label}</Text>
              <Progress value={row.pct} tone={row.isPaid === false ? 'warning' : 'info'} className={styles.bar} aria-label={label} />
              <Text as="span" variant="xs" className={styles.rowValue}>{`${time(row.totalSec)} · ${row.pct}%`}</Text>
            </Flex>
          );
        })}
      </VStack>
    </VStack>
  );
});
