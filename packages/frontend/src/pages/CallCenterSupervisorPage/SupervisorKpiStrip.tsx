import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { Button, Flex, Text, Tooltip } from '@/shared/ui';
import type { SupervisorKpiPeriodMeta, SupervisorKpiRollup } from '@/features/callcenter/lib/supervisorKpiRollup';
import { SLA_BREACH_MIN_SAMPLE } from '@/features/callcenter/lib/attentionItems';
import { callWaitSec, formatClock, isPendingCall } from '@/features/callcenter/lib/liveCallTiming';
import { useNowTick } from '@/features/callcenter/lib/useNowTick';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './SupervisorPulse.module.scss';

export type SupervisorMetric = 'sla' | 'answered' | 'abandoned' | 'waiting';
export interface SupervisorKpiThresholds {
  waitingDanger?: number;
  waitingWarning?: number;
  freeAgentsMin?: number;
  slaCriticalPct?: number;
  abandonedDanger?: number;
}

export const SupervisorKpiStrip = memo(function SupervisorKpiStrip({
  rollup, periodMeta, thresholds, calls = [], onSelect, queueCount,
}: {
  rollup: SupervisorKpiRollup;
  periodMeta: SupervisorKpiPeriodMeta;
  thresholds?: SupervisorKpiThresholds;
  calls?: readonly ICall[];
  queueCount?: number;
  onSelect?: (metric: SupervisorMetric) => void;
}) {
  const { t, i18n } = useTranslation();
  const now = useNowTick();
  const period = periodMeta.mode === 'business_day'
    ? t('callcenter.supervisor.pulse.businessDay', { time: periodMeta.boundaryTime })
    : t('callcenter.supervisor.pulse.calendarDay');
  const periodLabel = t(periodMeta.mode === 'business_day' ? 'callcenter.supervisor.pulse.reportingDay' : 'callcenter.supervisor.pulse.today');
  const longestWait = calls.reduce((longest, call) => isPendingCall(call) ? Math.max(longest, callWaitSec(call, now)) : longest, 0);
  const lostRate = new Intl.NumberFormat(i18n?.resolvedLanguage || i18n?.language || 'ru', { maximumFractionDigits: 1 })
    .format(rollup.period.effectiveOffered > 0 ? rollup.period.abandoned / rollup.period.effectiveOffered * 100 : 0);
  const slaTarget = thresholds?.slaCriticalPct ?? 80;
  const slaLow = rollup.period.effectiveOffered >= SLA_BREACH_MIN_SAMPLE && rollup.period.sla < slaTarget;
  const rows: Array<{ id: SupervisorMetric; label: string; value: string | number; note: string; tone: 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info' }> = [
    { id: 'sla', label: 'SLA', value: rollup.period.effectiveOffered > 0 ? `${rollup.period.sla}%` : '—',
      note: rollup.period.effectiveOffered > 0
        ? t('callcenter.supervisor.pulse.target', { value: slaTarget }) : t('callcenter.supervisor.pulse.noSample'),
      tone: rollup.period.effectiveOffered === 0 ? 'muted' : slaLow ? 'warning' : rollup.period.sla >= slaTarget ? 'success' : 'info' },
    { id: 'answered', label: t('callcenter.supervisor.pulse.answered'), value: rollup.period.answered,
      note: queueCount == null ? t('callcenter.supervisor.pulse.queueScope') : t('callcenter.supervisor.pulse.queueScopeCount', { count: queueCount }), tone: 'neutral' },
    { id: 'abandoned', label: t('callcenter.supervisor.pulse.lost'), value: rollup.period.abandoned,
      note: rollup.period.effectiveOffered > 0 ? t('callcenter.supervisor.pulse.lostRate', { value: lostRate }) : t('callcenter.supervisor.pulse.noSample'), tone: rollup.period.abandoned > 0 ? 'danger' : 'muted' },
    { id: 'waiting', label: t('callcenter.supervisor.waiting', 'Waiting'), value: rollup.live.waiting,
      note: rollup.live.waiting > 0 ? t('callcenter.supervisor.pulse.maximumWait', { time: formatClock(longestWait) }) : t('callcenter.supervisor.pulse.noWaiting'),
      tone: rollup.live.waiting > (thresholds?.waitingWarning ?? 2) ? 'warning' : 'info' },
  ];
  return <Flex as="section" className={styles.overview} aria-label={t('callcenter.supervisor.pulse.queueScope')} data-testid="supervisor-pulse-kpis">
    {rows.map(row => <Tooltip key={row.id} content={row.id === 'waiting' ? t('callcenter.supervisor.pulse.liveScope') : `${period} · ${t('callcenter.supervisor.pulse.queueScope')}`}>
      <Button type="button" variant="unstyled" size="none" className={styles.metric}
      onClick={() => onSelect?.(row.id)} aria-label={t('callcenter.supervisor.pulse.metricDetails', { name: row.label })}
      data-testid={`supervisor-metric-${row.id}`} data-tone={row.tone}>
      <Text as="span" className={styles.metricLabel}>{row.label}<Text as="span" className={styles.metricPeriod}> · {row.id === 'waiting' ? t('callcenter.supervisor.pulse.now') : periodLabel}</Text><ArrowUpRight size={12} aria-hidden /></Text>
      <Text as="span" className={styles.metricValue}>{row.value}</Text>
      <Text as="span" className={styles.metricNote}>{row.note}</Text>
    </Button></Tooltip>)}
  </Flex>;
});
