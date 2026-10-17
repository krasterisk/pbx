import type { CcDashboardSeries, CcDashboardSeriesGranularity, CcDashboardSource } from '@krasterisk/shared';
import { formatIntervalLabel, type IntradayChartPoint } from '@/features/callcenter/lib/intradayChartData';

export type SparkMetric = 'offered' | 'handled' | 'sla' | 'abandonRate' | 'asa' | 'aht';

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayLabel(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit' });
    } catch {
      formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
    }
    dayFormatters.set(timeZone, formatter);
  }
  // en-GB renders 15/07; a dot is the local convention for ru and harmless for en.
  return formatter.format(new Date(ms)).replace('/', '.');
}

/** Axis label of a series point in the tenant timezone: `HH:mm` for half hours, `DD.MM` for days. */
export function seriesPointLabel(iso: string, timeZone: string, granularity: CcDashboardSeriesGranularity): string {
  return granularity === 'halfHour' ? formatIntervalLabel(iso, timeZone) : dayLabel(iso, timeZone);
}

/** Dashboard series -> the shared intraday chart shape. The "previous" line draws offered calls. */
export function toChartPoints(series: CcDashboardSeries, timeZone: string): IntradayChartPoint[] {
  let offeredSoFar = 0;
  const isDaily = series.granularity === 'day';
  return series.points.map((point, index) => {
    offeredSoFar += point.offered;
    const effectiveBucket = point.offered - point.shortAbandoned;
    const slaLine = isDaily
      ? (effectiveBucket > 0 ? point.sla : null)
      : (offeredSoFar > 0 ? point.cumulativeSla : null);
    return {
      at: point.at,
      label: seriesPointLabel(point.at, timeZone, series.granularity),
      answered: point.handled,
      abandoned: point.abandoned,
      shortAbandoned: point.shortAbandoned,
      cumulativeSla: slaLine,
      previousOffered: series.previous ? (series.previous[index]?.offered ?? 0) : null,
    };
  });
}

/**
 * Values for a KPI sparkline. Ratios and averages skip points where they are meaningless
 * (no calls / nothing handled) instead of drawing a false drop to zero.
 */
export function sparkValues(series: CcDashboardSeries | null | undefined, metric: SparkMetric): number[] {
  if (!series) return [];
  const points = series.points;
  switch (metric) {
    case 'offered':
      return points.map((p) => p.offered);
    case 'handled':
      return points.map((p) => p.handled);
    case 'sla':
    case 'abandonRate':
      return points.filter((p) => p.offered - p.shortAbandoned > 0).map((p) => p[metric]);
    case 'asa':
    case 'aht':
      return points.filter((p) => p.handled > 0).map((p) => p[metric]);
  }
}

export type CcSourceState = 'ok' | 'stale' | 'unavailable' | 'notConfigured';

/** Map a dashboard section source onto the shared `DashboardSource` badge vocabulary. */
export function toBadgeSource(source: CcDashboardSource): {
  state: CcSourceState;
  updatedAt: string | null;
  message?: string;
} {
  return {
    state: source.state === 'error' ? 'unavailable' : source.state,
    updatedAt: source.updatedAt,
    message: source.message,
  };
}

/** The worst source state among sections, so one badge can summarise the page. */
export function worstSource(sources: readonly CcDashboardSource[]): CcDashboardSource | null {
  const rank: Record<CcDashboardSource['state'], number> = { ok: 0, notConfigured: 1, stale: 2, error: 3 };
  let worst: CcDashboardSource | null = null;
  for (const source of sources) {
    if (worst === null || rank[source.state] > rank[worst.state]) worst = source;
  }
  return worst;
}
