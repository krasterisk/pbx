import type { CcDashboardService, CcServiceKpis } from '@krasterisk/shared';
import type { CcReportId } from '@/shared/api/endpoints/callCenterReportsApi';
import { abandonTone, slaTone, type KpiThresholds, type KpiTone } from '@/features/callcenter/lib/kpiThresholds';
import { formatClock } from '@/features/callcenter/lib/liveCallTiming';
import { kpiDelta, signed, type KpiDelta, type KpiDirection } from './kpiDelta';
import type { SparkMetric } from './dashboardView';

export type KpiCardId = 'offered' | 'handled' | 'sla' | 'abandon' | 'asa' | 'aht';

export interface KpiCardModel {
  id: KpiCardId;
  value: string;
  tone: KpiTone;
  /** `points`: absolute change of a percentage; `relative`: change in percent of the previous value. */
  deltaKind: 'points' | 'relative';
  delta: KpiDelta | null;
  spark: SparkMetric;
  /** Short abandons excluded from the verdict - shown as a note on the abandon card. */
  shortAbandoned: number;
  /** Target report when the card is clicked (U4.3). */
  reportId: CcReportId;
  /** Formatted threshold target (e.g. `70%`, `10%`, `1:00`) when applicable (U4.2). */
  targetValue?: string;
}

/** Short abandons are not countable traffic: with only those, ratios have no verdict yet. */
export const hasVerdict = (k: CcServiceKpis): boolean => k.offered - k.shortAbandoned > 0;

const NO_VALUE = '—';

/** Text of a delta ("+5 pp" / "-12%") - the unit label comes from the caller (i18n). */
export function formatDelta(delta: KpiDelta, kind: KpiCardModel['deltaKind'], pointsUnit: string): string {
  if (kind === 'points') return `${signed(delta.abs)} ${pointsUnit}`;
  return delta.pct !== null ? `${signed(delta.pct)}%` : signed(delta.abs);
}

export function buildKpiCards(service: CcDashboardService, thresholds: KpiThresholds): KpiCardModel[] {
  const cur = service.current;
  const prev = service.previous;
  const verdict = hasVerdict(cur);
  const prevVerdict = prev !== null && hasVerdict(prev);
  const handledBoth = cur.handled > 0 && prev !== null && prev.handled > 0;
  const delta = (current: number, previous: number | undefined, direction: KpiDirection, comparable: boolean) =>
    comparable && previous !== undefined ? kpiDelta(current, previous, direction) : null;

  return [
    {
      id: 'offered',
      value: String(cur.offered),
      tone: 'default',
      deltaKind: 'relative',
      delta: delta(cur.offered, prev?.offered, 'neutral', prev !== null && prev.offered > 0),
      spark: 'offered',
      shortAbandoned: 0,
      reportId: 'queue-summary',
    },
    {
      id: 'handled',
      value: String(cur.handled),
      tone: 'default',
      deltaKind: 'relative',
      delta: delta(cur.handled, prev?.handled, 'neutral', prev !== null && prev.handled > 0),
      spark: 'handled',
      shortAbandoned: 0,
      reportId: 'queue-summary',
    },
    {
      id: 'sla',
      value: verdict ? `${cur.sla}%` : NO_VALUE,
      tone: verdict ? slaTone(cur.sla, thresholds) : 'default',
      deltaKind: 'points',
      delta: delta(cur.sla, prev?.sla, 'higherIsBetter', verdict && prevVerdict),
      spark: 'sla',
      shortAbandoned: 0,
      reportId: 'queue-summary',
      targetValue: `${thresholds.slaCriticalPct}%`,
    },
    {
      id: 'abandon',
      value: verdict ? `${cur.abandonRate}%` : NO_VALUE,
      tone: verdict ? abandonTone(cur.abandoned, cur.offered - cur.shortAbandoned, thresholds) : 'default',
      deltaKind: 'points',
      delta: delta(cur.abandonRate, prev?.abandonRate, 'lowerIsBetter', verdict && prevVerdict),
      spark: 'abandonRate',
      shortAbandoned: cur.shortAbandoned,
      reportId: 'missed-callback',
      targetValue: `${thresholds.abandonRatePct}%`,
    },
    {
      id: 'asa',
      value: cur.handled > 0 ? formatClock(cur.asa) : NO_VALUE,
      tone: 'default',
      deltaKind: 'relative',
      delta: delta(cur.asa, prev?.asa, 'lowerIsBetter', handledBoth),
      spark: 'asa',
      shortAbandoned: 0,
      reportId: 'queue-summary',
      targetValue: formatClock(thresholds.maxWaitSec),
    },
    {
      id: 'aht',
      value: cur.handled > 0 ? formatClock(cur.aht) : NO_VALUE,
      tone: 'default',
      deltaKind: 'relative',
      delta: delta(cur.aht, prev?.aht, 'lowerIsBetter', handledBoth),
      spark: 'aht',
      shortAbandoned: 0,
      reportId: 'operator-stats',
    },
  ];
}
