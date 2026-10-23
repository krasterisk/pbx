import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { Button, Flex, Text } from '@/shared/ui';
import type { SupervisorKpiPeriodMeta, SupervisorKpiRollup } from '@/features/callcenter/lib/supervisorKpiRollup';
import { SLA_BREACH_MIN_SAMPLE } from '@/features/callcenter/lib/attentionItems';
import { longestWaitSec, formatClock } from '@/features/callcenter/lib/liveCallTiming';
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
  rollup, periodMeta, thresholds, calls = [], onSelect,
}: {
  rollup: SupervisorKpiRollup;
  periodMeta: SupervisorKpiPeriodMeta;
  thresholds?: SupervisorKpiThresholds;
  calls?: readonly ICall[];
  onSelect?: (metric: SupervisorMetric) => void;
}) {
  const { t } = useTranslation();
  const now = useNowTick();
  const period = periodMeta.mode === 'business_day'
    ? t('callcenter.supervisor.pulse.businessDay', { time: periodMeta.boundaryTime })
    : t('callcenter.supervisor.pulse.calendarDay');
  const rows: Array<{ id: SupervisorMetric; label: string; value: string | number; note: string; warning?: boolean }> = [
    { id: 'sla', label: 'SLA', value: rollup.period.effectiveOffered > 0 ? `${rollup.period.sla}%` : '—',
      note: rollup.period.effectiveOffered > 0
        ? t('callcenter.supervisor.pulse.target', { value: thresholds?.slaCriticalPct ?? 80 }) : t('callcenter.supervisor.pulse.noSample'),
      warning: rollup.period.effectiveOffered >= SLA_BREACH_MIN_SAMPLE && rollup.period.sla < (thresholds?.slaCriticalPct ?? 80) },
    { id: 'answered', label: t('callcenter.supervisor.answered', 'Answered'), value: rollup.period.answered,
      note: t('callcenter.supervisor.pulse.queueScope') },
    { id: 'abandoned', label: t('callcenter.supervisor.abandoned', 'Lost'), value: rollup.period.abandoned,
      note: t('callcenter.supervisor.pulse.queueScope') },
    { id: 'waiting', label: t('callcenter.supervisor.waiting', 'Waiting'), value: rollup.live.waiting,
      note: t('callcenter.supervisor.pulse.maximumWait', { time: formatClock(longestWaitSec(calls, now)) }),
      warning: rollup.live.waiting > (thresholds?.waitingWarning ?? 2) },
  ];
  return <Flex as="section" className={styles.overview} aria-label={t('callcenter.supervisor.pulse.queueScope')} data-testid="supervisor-pulse-kpis">
    {rows.map(row => <Button key={row.id} type="button" variant="unstyled" size="none" className={styles.metric}
      onClick={() => onSelect?.(row.id)} aria-label={t('callcenter.supervisor.pulse.metricDetails', { name: row.label })}
      data-testid={`supervisor-metric-${row.id}`}>
      <Text as="span" className={styles.metricLabel}>{row.label} · {row.id === 'waiting' ? t('callcenter.supervisor.pulse.now') : period}<ArrowUpRight size={12} aria-hidden /></Text>
      <Text as="span" className={`${styles.metricValue} ${row.warning ? styles.metricWarning : ''}`}>{row.value}</Text>
      <Text as="span" className={styles.metricNote}>{row.note}</Text>
    </Button>)}
  </Flex>;
});
