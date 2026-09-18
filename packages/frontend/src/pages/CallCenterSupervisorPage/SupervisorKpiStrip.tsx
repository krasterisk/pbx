import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import styles from './CallCenterSupervisorPage.module.scss';

function formatWait(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toSparkSnapshot(rollup: SupervisorKpiRollup): KpiSnapshot {
  return {
    waiting: rollup.live.waiting,
    talking: rollup.live.talking,
    freeAgents: rollup.live.freeAgents,
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
  const sparkKpis = useMemo(() => toSparkSnapshot(rollup), [rollup]);
  const samples = useKpiSamples(sparkKpis);

  const waitingDanger = thresholds?.waitingDanger ?? 5;
  const waitingWarning = thresholds?.waitingWarning ?? 2;
  const freeMin = thresholds?.freeAgentsMin ?? 2;
  const slaCritical = thresholds?.slaCriticalPct ?? 80;
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
      label: t('callcenter.supervisor.freeAgents', 'Free'),
      value: rollup.live.freeAgents,
      icon: Users,
      danger: rollup.live.freeAgents < freeMin,
      success: rollup.live.freeAgents >= freeMin,
      spark: samples.map((s) => s.freeAgents),
    },
    {
      key: 'totalAgents',
      label: t('callcenter.supervisor.totalAgents', 'Agents'),
      value: rollup.live.totalAgents,
      icon: Headphones,
      spark: samples.map((s) => s.freeAgents),
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
      danger: rollup.period.offered > 0 && rollup.period.sla < slaCritical,
      success: rollup.period.offered > 0 && rollup.period.sla >= slaCritical,
      spark: samples.map((s) => s.sla),
    },
    {
      key: 'avgWait',
      label: t('callcenter.supervisor.avgWait', 'Avg Wait'),
      value: formatWait(rollup.period.avgWait),
      icon: Clock,
      spark: samples.map((s) => s.avgWait),
    },
  ];

  const renderCards = (cards: Array<{ key: string; label: string; value: string | number; icon?: typeof Phone; spark: number[]; danger?: boolean; warning?: boolean; success?: boolean }>) => (
    <div className={styles.kpiStrip}>
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
              {card.label}
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
      <div className={styles.kpiGroup}>
        <div className={styles.kpiGroupHeader}>
          <Text className={styles.kpiGroupTitle} title={periodLabel}>
            {periodLabel}
          </Text>
        </div>
        {renderCards(periodCards)}
      </div>
    </div>
  );
}, (prev, next) => (
  rollupsEqual(prev.rollup, next.rollup)
  && prev.periodMeta.mode === next.periodMeta.mode
  && prev.periodMeta.boundaryTime === next.periodMeta.boundaryTime
));
