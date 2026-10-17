import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  PhoneIncoming, Phone, Users, Clock, TrendingDown, Headphones, CheckCircle2,
} from 'lucide-react';
import { Flex, Text, Sparkline } from '@/shared/ui';
import {
  sameKpiSnapshot,
  useKpiSamples,
  type KpiSnapshot,
} from '@/features/callcenter/lib/useKpiSamples';
import type {
  SupervisorKpiPeriodMeta,
  SupervisorKpiRollup,
} from '@/features/callcenter/lib/supervisorKpiRollup';
import { DEFAULT_KPI_THRESHOLDS } from '@/features/callcenter/lib/kpiThresholds';
import { SLA_BREACH_MIN_SAMPLE } from '@/features/callcenter/lib/attentionItems';
import { formatCcDuration } from '@/features/callcenter/lib/ccFormat';
import { CcMetricLabel } from '@/features/callcenter/ui/CcMetricLabel/CcMetricLabel';
import styles from './CallCenterSupervisorPage.module.scss';

function toSparkSnapshot(rollup: SupervisorKpiRollup): KpiSnapshot {
  return {
    waiting: rollup.live.waiting,
    talking: rollup.live.talking,
    freeAgents: rollup.live.freeAgents,
    totalAgents: rollup.live.totalAgents,
    sla: rollup.period.sla,
    avgWait: rollup.period.avgWait,
    abandoned: rollup.period.abandoned,
    answered: rollup.period.answered,
  };
}

function rollupsEqual(a: SupervisorKpiRollup, b: SupervisorKpiRollup): boolean {
  return sameKpiSnapshot(toSparkSnapshot(a), toSparkSnapshot(b))
    && a.live.totalAgents === b.live.totalAgents
    && a.period.answered === b.period.answered
    && a.period.offered === b.period.offered;
}

export interface SupervisorKpiThresholds {
  waitingDanger?: number;
  waitingWarning?: number;
  freeAgentsMin?: number;
  slaCriticalPct?: number;
  abandonedDanger?: number;
}

/**
 * KPI badges + sparklines. Isolated so sample updates never remount the agents table.
 * Split into live snapshot vs reporting-day period (Genesys-style).
 */
export const SupervisorKpiStrip = memo(function SupervisorKpiStrip({
  rollup,
  periodMeta,
  thresholds,
}: {
  rollup: SupervisorKpiRollup;
  periodMeta: SupervisorKpiPeriodMeta;
  thresholds?: SupervisorKpiThresholds;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(1024);
  const sparkKpis = useMemo(() => toSparkSnapshot(rollup), [rollup]);
  const samples = useKpiSamples(sparkKpis);

  const waitingDanger = thresholds?.waitingDanger ?? 5;
  const waitingWarning = thresholds?.waitingWarning ?? 2;
  const freeMin = thresholds?.freeAgentsMin ?? DEFAULT_KPI_THRESHOLDS.agentsAvailableMin;
  const slaCritical = thresholds?.slaCriticalPct ?? DEFAULT_KPI_THRESHOLDS.slaCriticalPct;
  const abandonedDanger = thresholds?.abandonedDanger ?? 5;

  const periodLabel = periodMeta.mode === 'business_day'
    ? t('callcenter.supervisor.kpi.periodBusiness', 'Day from {{time}}', {
      time: periodMeta.boundaryTime,
    })
    : t('callcenter.supervisor.kpi.periodCalendar', 'Today from 00:00');

  const liveCards = [
    {
      key: 'waiting',
      label: t('callcenter.supervisor.waiting', 'Waiting'),
      value: rollup.live.waiting,
      icon: PhoneIncoming,
      danger: rollup.live.waiting > waitingDanger,
      warning: rollup.live.waiting > waitingWarning,
      spark: samples.map((s) => s.waiting),
    },
    {
      key: 'talking',
      label: t('callcenter.supervisor.inCall', 'In Call'),
      value: rollup.live.talking,
      icon: Phone,
      spark: samples.map((s) => s.talking),
    },
    {
      key: 'free',
      label: t('callcenter.supervisor.freeWatched', 'Ready in watchlist'),
      value: rollup.live.freeAgents,
      icon: Users,
      danger:
        rollup.live.freeAgents < freeMin
        && (rollup.live.waiting > 0 || (rollup.live.totalAgents > 0 && rollup.live.talking > 0)),
      success: rollup.live.totalAgents > 0 && rollup.live.freeAgents >= freeMin,
      spark: samples.map((s) => s.freeAgents),
    },
    {
      key: 'totalAgents',
      label: t('callcenter.supervisor.totalAgents', 'Agents'),
      value: rollup.live.totalAgents,
      icon: Headphones,
      spark: samples.map((s) => s.totalAgents ?? 0),
    },
  ];

  const periodCards = [
    {
      key: 'answered',
      label: t('callcenter.supervisor.answered', 'Answered'),
      value: rollup.period.answered,
      icon: CheckCircle2,
      spark: samples.map((s) => s.answered ?? 0),
    },
    {
      key: 'abandoned',
      label: t('callcenter.supervisor.abandoned', 'Lost'),
      value: rollup.period.abandoned,
      icon: TrendingDown,
      danger: rollup.period.abandoned > abandonedDanger,
      spark: samples.map((s) => s.abandoned),
    },
    {
      key: 'sla',
      label: 'SLA %',
      value: `${rollup.period.sla}%`,
      danger: rollup.period.effectiveOffered >= SLA_BREACH_MIN_SAMPLE && rollup.period.sla < slaCritical,
      success: rollup.period.effectiveOffered >= SLA_BREACH_MIN_SAMPLE && rollup.period.sla >= slaCritical,
      spark: samples.map((s) => s.sla),
    },
    {
      key: 'avgWait',
      label: t('callcenter.supervisor.avgWait', 'Avg Wait'),
      value: formatCcDuration(rollup.period.avgWait),
      icon: Clock,
      spark: samples.map((s) => s.avgWait),
    },
  ];

  const renderCards = (cards: Array<{ key: string; label: string; value: string | number; icon?: typeof Phone; spark: number[]; danger?: boolean; warning?: boolean; success?: boolean }>) => (
    <div className={styles.kpiStrip} title={t('callcenter.supervisor.kpiScope', 'Agent counts use the watchlist; call counts use the selected queues.')}>
      {cards.map((card) => {
        const Icon = card.icon;
        const cardClass = [
          styles.kpiCard,
          card.danger ? styles.kpiDanger : '',
          card.warning ? styles.kpiWarning : '',
          card.success ? styles.kpiSuccess : '',
        ].filter(Boolean).join(' ');
        return (
          <div key={card.key} className={cardClass}>
            <Text className={styles.kpiLabel}>
              {Icon && <Icon className="w-3 h-3 inline mr-1" />}
              <CcMetricLabel metric={card.key} period={['waiting', 'talking', 'free', 'totalAgents'].includes(card.key) ? t('callcenter.supervisor.kpi.now', 'Now') : periodLabel} sample={card.key === 'sla' ? rollup.period.effectiveOffered : undefined}>{card.label}</CcMetricLabel>
            </Text>
            <Flex align="center" justify="between" gap="8">
              <Text className={styles.kpiValue}>{card.value}</Text>
              <Sparkline data={card.spark} />
            </Flex>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={styles.kpiGroups}>
      <div className={styles.kpiGroup}>
        <div className={styles.kpiGroupHeader}>
          <Text className={styles.kpiGroupTitle}>
            {t('callcenter.supervisor.kpi.now', 'Now')}
          </Text>
        </div>
        {renderCards(liveCards)}
      </div>
      <details className={`${styles.kpiGroup} ${styles.periodGroup}`} open={!isMobile}>
        <summary className={styles.kpiGroupHeader}>
          <Text className={styles.kpiGroupTitle} title={periodLabel}>
            {periodLabel}
          </Text>
        </summary>
        {renderCards(periodCards)}
      </details>
    </div>
  );
}, (prev, next) => (
  rollupsEqual(prev.rollup, next.rollup)
  && prev.periodMeta.mode === next.periodMeta.mode
  && prev.periodMeta.boundaryTime === next.periodMeta.boundaryTime
));
