/**
 * Standard dashboard aggregations (D-34).
 * Access list matches journal visibility. Low-STT excluded from averages with count shown.
 * Cost cards sum latest-run amounts only (insights excluded by caller).
 */

import { Injectable } from '@nestjs/common';
import type { CdrAccessScope } from '../../reports/cdr/cdr-access-scope';
import {
  isJournalRowVisible,
  type JournalViewer,
} from '../journal/journal.service';

export type DashboardCallMetric = {
  id: string;
  value: number | string | boolean;
  rationale: string;
};

export type DashboardCall = {
  id: string;
  occurredAt: string;
  dayLabel: string;
  operatorName: string | null;
  callerPhone: string | null;
  score: number | null;
  success: boolean | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  lowStt: boolean;
  latestAmount: string | null;
  currency: string | null;
  topics: string[];
  metrics: DashboardCallMetric[];
};

export type DashboardOperatorRank = {
  operatorName: string | null;
  callsCount: number;
  averageScore: number | null;
  successRate: number | null;
  negativeRate: number | null;
};

export type DashboardConversation = {
  id: string;
  operatorExten: string | null;
  operatorName: string | null;
  callerPhone?: string | null;
  uploadedByUserId: number | null;
  sourceKind: string;
  latestAmount: string | null;
  currency: string | null;
  lowStt: boolean;
  success: boolean | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  metricScores: Record<string, number>;
  metricNotes?: Record<string, string>;
  topics?: string[];
  occurredAt?: string;
  dayLabel: string;
  overallScore: number | null;
  durationMs?: number | null;
};

export type DashboardAggregateInput = {
  conversations: DashboardConversation[];
  scope: CdrAccessScope | null;
  viewer: JournalViewer;
};

export type DashboardAggregate = {
  conversationCount: number;
  lowSttCount: number;
  costTotal: string;
  averageCost: string | null;
  averageDurationMs: number | null;
  currency: string | null;
  successRate: number | null;
  averageScore: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  metrics: Array<{ id: string; label: string; avg: number }>;
  dynamics: Array<{ label: string; avgScore: number; calls: number }>;
  ranking: 'ok' | 'insufficient_sample';
  operators: DashboardOperatorRank[];
  topics: Array<{ label: string; count: number }>;
  calls: DashboardCall[];
};

export function filterDashboardByAccess(
  conversations: DashboardConversation[],
  scope: CdrAccessScope | null,
  viewer: JournalViewer,
): DashboardConversation[] {
  return conversations.filter((row) => isJournalRowVisible(row, scope, viewer));
}

function sumLatestRunAmounts(rows: DashboardConversation[]): {
  total: string;
  currency: string | null;
} {
  let currency: string | null = null;
  let sum = 0;
  for (const row of rows) {
    if (row.latestAmount == null || row.latestAmount === '') continue;
    const n = Number(row.latestAmount);
    if (!Number.isFinite(n)) continue;
    sum += n;
    currency = row.currency ?? currency;
  }
  return { total: sum.toFixed(2), currency };
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function averageDurationMs(rows: DashboardConversation[]): number | null {
  const values = rows
    .map((row) => row.durationMs)
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  const mean = average(values);
  return mean == null ? null : Math.round(mean);
}

const DASHBOARD_INSIGHT_IDS = new Set([
  'summary', 'csat', 'customer_sentiment', 'sentiment', 'topics', 'success', 'scenario_success',
]);

/** Numeric project metrics from one analysis result. Insight fields stay out of the averages. */
export function readDashboardMetricScores(
  metricResults: unknown,
): { scores: Record<string, number>; rationales: Record<string, string> } {
  let parsed: unknown = metricResults;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) as unknown; } catch { parsed = null; }
  }
  const scores: Record<string, number> = {};
  const rationales: Record<string, string> = {};
  if (!Array.isArray(parsed)) return { scores, rationales };
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { id?: unknown; value?: unknown; rationale?: unknown };
    const id = String(row.id ?? '');
    const value = row.value;
    if (!id || id.startsWith('_') || DASHBOARD_INSIGHT_IDS.has(id)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    scores[id] = value;
    if (typeof row.rationale === 'string' && row.rationale.trim()) {
      rationales[id] = row.rationale.trim().slice(0, 180);
    }
  }
  return { scores, rationales };
}

/** Project definition order first, then any scored metric that is not in that list. */
export function orderDashboardMetrics(
  metrics: Array<{ id: string; label: string; avg: number }>,
  order: readonly string[],
  labels: ReadonlyMap<string, string>,
): Array<{ id: string; label: string; avg: number }> {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const used = new Set<string>();
  const ordered: Array<{ id: string; label: string; avg: number }> = [];
  for (const id of order) {
    const row = byId.get(id);
    if (!row) continue;
    used.add(id);
    ordered.push({ ...row, label: labels.get(id) ?? row.label });
  }
  for (const row of metrics) {
    if (used.has(row.id)) continue;
    ordered.push({ ...row, label: labels.get(row.id) ?? row.label });
  }
  return ordered;
}

export function dashboardDayLabel(occurredAt: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(occurredAt);
  } catch {
    return occurredAt.toISOString().slice(0, 10);
  }
}

function avgByKey(rows: DashboardConversation[], pick: (row: DashboardConversation) => Record<string, number>): Array<{ key: string; avg: number }> {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(pick(row))) {
      if (!Number.isFinite(value)) continue;
      const list = buckets.get(key) ?? [];
      list.push(value);
      buckets.set(key, list);
    }
  }
  return [...buckets.entries()].map(([key, values]) => ({
    key,
    avg: average(values) ?? 0,
  }));
}

export function aggregateDashboard(input: DashboardAggregateInput): DashboardAggregate {
  const visible = filterDashboardByAccess(input.conversations, input.scope, input.viewer);
  const lowSttCount = visible.filter((r) => r.lowStt).length;
  const forAverages = visible.filter((r) => !r.lowStt);
  const { total, currency } = sumLatestRunAmounts(visible);

  const scores = forAverages
    .map((r) => r.overallScore)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const averageScore = average(scores);

  const successRows = forAverages.filter((r) => r.success != null);
  const successRate = successRows.length
    ? successRows.filter((r) => r.success === true).length / successRows.length
    : null;

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const row of forAverages) {
    if (row.sentiment === 'positive') sentiment.positive += 1;
    else if (row.sentiment === 'neutral') sentiment.neutral += 1;
    else if (row.sentiment === 'negative') sentiment.negative += 1;
  }

  const dayBuckets = new Map<string, number[]>();
  for (const row of forAverages) {
    if (row.overallScore == null) continue;
    const list = dayBuckets.get(row.dayLabel) ?? [];
    list.push(row.overallScore);
    dayBuckets.set(row.dayLabel, list);
  }
  const dynamics = [...dayBuckets.entries()].map(([label, values]) => ({
    label,
    avgScore: average(values) ?? 0,
    calls: values.length,
  }));

  return {
    conversationCount: visible.length,
    lowSttCount,
    costTotal: total,
    averageCost: visible.length ? (Number(total) / visible.length).toFixed(2) : null,
    averageDurationMs: averageDurationMs(forAverages),
    currency,
    successRate,
    averageScore,
    sentiment,
    metrics: avgByKey(forAverages, (r) => r.metricScores).map((metric) => ({
      id: metric.key,
      label: metric.key,
      avg: metric.avg,
    })),
    dynamics: [...dynamics].sort((left, right) => left.label.localeCompare(right.label)),
    ranking: forAverages.length >= 20 ? 'ok' : 'insufficient_sample',
    operators: operatorRanking(visible),
    topics: topicCounts(forAverages),
    calls: visible.map(toDashboardCall),
  };
}

function operatorKey(name: string | null | undefined): string {
  return name?.trim() || '';
}

function operatorRanking(rows: DashboardConversation[]): DashboardOperatorRank[] {
  const groups = new Map<string, DashboardConversation[]>();
  for (const row of rows) {
    const key = operatorKey(row.operatorName);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([name, group]) => {
    const scored = group.filter((row) => !row.lowStt);
    const scores = scored
      .map((row) => row.overallScore)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const successRows = scored.filter((row) => row.success != null);
    const sentimentRows = scored.filter((row) => row.sentiment != null);
    const negative = sentimentRows.filter((row) => row.sentiment === 'negative').length;
    return {
      operatorName: name || null,
      callsCount: group.length,
      averageScore: average(scores),
      successRate: successRows.length
        ? successRows.filter((row) => row.success === true).length / successRows.length
        : null,
      negativeRate: sentimentRows.length ? negative / sentimentRows.length : null,
    };
  }).sort((left, right) => (
    (right.averageScore ?? -1) - (left.averageScore ?? -1) || right.callsCount - left.callsCount
  ));
}

function topicCounts(rows: DashboardConversation[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const topic of row.topics ?? []) {
      const label = topic.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function toDashboardCall(row: DashboardConversation): DashboardCall {
  const notes = row.metricNotes ?? {};
  const metrics = Object.entries(row.metricScores).map(([id, value]) => ({
    id,
    value,
    rationale: notes[id] ?? '',
  }));
  return {
    id: row.id,
    occurredAt: row.occurredAt ?? '',
    dayLabel: row.dayLabel,
    operatorName: row.operatorName?.trim() || null,
    callerPhone: row.callerPhone ?? null,
    score: row.overallScore,
    success: row.success,
    sentiment: row.sentiment,
    lowStt: row.lowStt,
    latestAmount: row.latestAmount,
    currency: row.currency,
    topics: row.topics ?? [],
    metrics,
  };
}

@Injectable()
export class DashboardService {
  aggregate(input: DashboardAggregateInput): DashboardAggregate {
    return aggregateDashboard(input);
  }
}
