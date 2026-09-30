import { DomainError } from '../project-engine';
import type { DashboardCall } from './dashboard.service';

const EXEMPLAR_LIMIT = 5;
const DISTRIBUTION_LIMIT = 5000;

export type DrillSentiment = 'positive' | 'neutral' | 'negative';

export type DashboardDrillSpec = {
  type: 'all' | 'lowStt' | 'cost' | 'success' | 'sentiment' | 'day' | 'topic' | 'operator' | 'metric' | 'exemplars' | 'recordings';
  recordingIds?: string[];
  sentiment?: string;
  success?: string | boolean;
  day?: string;
  topic?: string;
  operatorName?: string | null;
  metricId?: string;
  insightType?: string;
};

/** Same accepted values as aiPBX parseSentimentFilter. */
export function parseSentimentFilter(raw?: string): DrillSentiment | null {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toLowerCase();
  if (key === 'positive' || key === 'neutral' || key === 'negative') return key;
  throw new DomainError('filter_invalid', 400, 'sentiment must be positive, neutral, or negative');
}

/** Same accepted values as aiPBX parseSuccessFilter. */
export function parseSuccessFilter(raw?: string | boolean): boolean | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (raw === true || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === '0') return false;
  throw new DomainError('filter_invalid', 400, 'success must be true or false');
}

/**
 * Intersect a new id list with the filter already applied.
 * An empty incoming list becomes a sentinel so the result stays empty.
 */
export function applyRecordingIdFilter(
  current: string[] | null,
  recordingIds: string[],
  emptySentinel: string,
): string[] {
  const next = recordingIds.length ? recordingIds : [emptySentinel];
  if (!current) return next.filter((id) => id !== emptySentinel);
  const prev = new Set(current);
  return next.filter((id) => prev.has(id));
}

export function readMetricValue(call: DashboardCall, metricKey: string): number | null {
  const row = call.metrics.find((metric) => metric.id === metricKey);
  if (!row) return null;
  return typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= DISTRIBUTION_LIMIT) break;
  }
  return out;
}

function metricSentiment(call: DashboardCall): string | null {
  const row = call.metrics.find((metric) => metric.id === 'customer_sentiment' || metric.id === 'sentiment');
  if (!row) return null;
  return String(row.value).trim().toLowerCase() || null;
}

function metricSuccess(call: DashboardCall): boolean | null {
  const row = call.metrics.find((metric) => metric.id === 'success' || metric.id === 'scenario_success');
  if (!row) return null;
  if (typeof row.value === 'boolean') return row.value;
  if (row.value === 1 || row.value === 'true' || row.value === '1') return true;
  if (row.value === 0 || row.value === 'false' || row.value === '0') return false;
  return null;
}

/**
 * Ids for a sentiment or success slice.
 * Metric rows win; if none match, fall back to the analysis fields on the call.
 */
export function findRecordingIdsForDistribution(
  calls: DashboardCall[],
  opts: { sentiment?: DrillSentiment; success?: boolean },
): string[] {
  if (!opts.sentiment && opts.success === undefined) return [];
  const fromMetrics = calls.filter((call) => {
    if (opts.sentiment) return metricSentiment(call) === opts.sentiment;
    return metricSuccess(call) === opts.success;
  }).map((call) => call.id);
  if (fromMetrics.length) return uniqueIds(fromMetrics);
  return uniqueIds(calls.filter((call) => {
    if (opts.sentiment) return call.sentiment === opts.sentiment;
    return call.success === opts.success;
  }).map((call) => call.id));
}

export function findRecordingIdsForTag(calls: DashboardCall[], tag: string): string[] {
  const name = tag.trim();
  if (!name) return [];
  return uniqueIds(calls.filter((call) => call.topics.includes(name)).map((call) => call.id));
}

/** Up to five exemplars. Gaps and outliers surface the worst scores; other insights surface the best. */
export function findExemplarRecordingIds(
  calls: DashboardCall[],
  evidence: { metric?: string; operators?: string[] },
  insightType: string,
): string[] {
  const operator = evidence.operators?.[0]?.trim().toLowerCase();
  let pool = calls;
  if (operator) {
    pool = calls.filter((call) => (call.operatorName ?? '').toLowerCase().includes(operator));
  }
  let ordered = pool;
  if (evidence.metric) {
    const metricKey = evidence.metric;
    const lowIsBad = insightType === 'gap' || insightType === 'outlier' || insightType === 'quality';
    ordered = [...pool].sort((left, right) => {
      const leftValue = readMetricValue(left, metricKey) ?? (lowIsBad ? 999 : -1);
      const rightValue = readMetricValue(right, metricKey) ?? (lowIsBad ? 999 : -1);
      return lowIsBad ? leftValue - rightValue : rightValue - leftValue;
    });
  }
  const ids: string[] = [];
  for (const call of ordered) {
    if (ids.includes(call.id)) continue;
    ids.push(call.id);
    if (ids.length >= EXEMPLAR_LIMIT) break;
  }
  return ids;
}

export function enrichInsightsWithRecordingIds<T extends { type: string; evidence?: { metric?: string; operators?: string[]; recordingIds?: string[] } }>(
  insights: T[],
  calls: DashboardCall[],
): T[] {
  return insights.map((insight) => {
    const recordingIds = findExemplarRecordingIds(calls, insight.evidence ?? {}, insight.type);
    if (!recordingIds.length) return insight;
    return {
      ...insight,
      evidence: { ...insight.evidence, recordingIds },
    };
  });
}

function withoutLowStt(calls: DashboardCall[]): DashboardCall[] {
  return calls.filter((call) => !call.lowStt);
}

/** The conversations that produced one dashboard figure. */
export function drillDashboardCalls(calls: DashboardCall[], spec: DashboardDrillSpec): DashboardCall[] {
  const byId = new Map(calls.map((call) => [call.id, call]));
  let ids: string[] | null = null;
  const take = (next: string[], sentinel: string) => {
    ids = applyRecordingIdFilter(ids, next, sentinel);
  };

  if (spec.type === 'recordings') {
    return (spec.recordingIds ?? [])
      .map((id) => byId.get(id))
      .filter((call): call is DashboardCall => Boolean(call));
  }
  if (spec.type === 'lowStt') {
    return calls.filter((call) => call.lowStt);
  }
  if (spec.type === 'cost') {
    return calls.filter((call) => call.latestAmount != null && call.latestAmount !== '');
  }
  if (spec.type === 'all') return calls;

  const scored = withoutLowStt(calls);
  if (spec.type === 'sentiment') {
    const sentiment = parseSentimentFilter(spec.sentiment);
    if (!sentiment) return [];
    take(findRecordingIdsForDistribution(scored, { sentiment }), '__no_matching_sentiment__');
  } else if (spec.type === 'success') {
    const success = parseSuccessFilter(spec.success);
    const pool = success == null
      ? scored.filter((call) => call.success != null)
      : scored;
    if (success == null) return pool;
    take(findRecordingIdsForDistribution(pool, { success }), '__no_matching_success__');
  } else if (spec.type === 'topic') {
    take(findRecordingIdsForTag(scored, spec.topic ?? ''), '__no_matching_tag__');
  } else if (spec.type === 'operator') {
    const name = spec.operatorName?.trim() || null;
    return calls.filter((call) => (call.operatorName?.trim() || null) === name);
  } else if (spec.type === 'day') {
    return scored.filter((call) => call.dayLabel === spec.day && call.score != null);
  } else if (spec.type === 'metric') {
    const metricId = spec.metricId ?? '';
    const operator = spec.operatorName === undefined ? undefined : (spec.operatorName?.trim() || null);
    return scored.filter((call) => {
      if (readMetricValue(call, metricId) == null) return false;
      if (operator === undefined) return true;
      return (call.operatorName?.trim() || null) === operator;
    });
  } else if (spec.type === 'exemplars') {
    const picked = findExemplarRecordingIds(scored, {
      metric: spec.metricId,
      operators: spec.operatorName ? [spec.operatorName] : [],
    }, spec.insightType ?? '');
    return picked.map((id) => byId.get(id)).filter((call): call is DashboardCall => Boolean(call));
  }

  return (ids ?? []).map((id) => byId.get(id)).filter((call): call is DashboardCall => Boolean(call));
}
