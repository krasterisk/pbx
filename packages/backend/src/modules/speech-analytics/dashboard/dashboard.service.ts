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

export type DashboardConversation = {
  id: string;
  operatorExten: string | null;
  operatorName: string | null;
  uploadedByUserId: number | null;
  sourceKind: string;
  latestAmount: string | null;
  currency: string | null;
  lowStt: boolean;
  success: boolean | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  scaleScores: Record<string, number>;
  customScores: Record<string, number>;
  dayLabel: string;
  overallScore: number | null;
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
  currency: string | null;
  successRate: number | null;
  averageScore: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  scales: Array<{ key: string; avg: number }>;
  customMetrics: Array<{ id: string; label: string; avg: number }>;
  dynamics: Array<{ label: string; avgScore: number; calls: number }>;
  ranking: 'ok' | 'insufficient_sample';
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
    currency,
    successRate,
    averageScore,
    sentiment,
    scales: avgByKey(forAverages, (r) => r.scaleScores),
    customMetrics: avgByKey(forAverages, (r) => r.customScores).map((m) => ({
      id: m.key,
      label: m.key,
      avg: m.avg,
    })),
    dynamics,
    ranking: forAverages.length >= 20 ? 'ok' : 'insufficient_sample',
  };
}

@Injectable()
export class DashboardService {
  aggregate(input: DashboardAggregateInput): DashboardAggregate {
    return aggregateDashboard(input);
  }
}
