/**
 * Standard dashboard aggregations (D-34) — RED stub for 18-08.
 * GREEN will honor access lists, exclude low-STT from averages, and sum latest-run costs only.
 */

import { Injectable } from '@nestjs/common';
import {
  isCdrUnrestricted,
  type CdrAccessScope,
} from '../../reports/cdr/cdr-access-scope';
import { normalizeAccessToken } from '../../callcenter/callcenter-access-list.util';
import { UserLevel } from '../../users/user.model';
import {
  isJournalRowVisible,
  type JournalRowAccessFields,
  type JournalViewer,
} from '../journal/journal.service';

export type DashboardConversation = JournalRowAccessFields & {
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

function sumAmounts(rows: DashboardConversation[]): { total: string; currency: string | null } {
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

/** RED stub: includes low-STT in averages and does not filter access — tests must fail. */
export function aggregateDashboard(input: DashboardAggregateInput): DashboardAggregate {
  const rows = input.conversations;
  const { total, currency } = sumAmounts(rows);
  const scores = rows
    .map((r) => r.overallScore)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const averageScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  const successRows = rows.filter((r) => r.success != null);
  const successRate = successRows.length
    ? successRows.filter((r) => r.success === true).length / successRows.length
    : null;

  return {
    conversationCount: rows.length,
    lowSttCount: 0,
    costTotal: total,
    currency,
    successRate,
    averageScore,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    scales: [],
    customMetrics: [],
    dynamics: [],
    ranking: rows.length >= 20 ? 'ok' : 'insufficient_sample',
  };
}

export function filterDashboardByAccess(
  conversations: DashboardConversation[],
  scope: CdrAccessScope | null,
  viewer: JournalViewer,
): DashboardConversation[] {
  // RED: no filtering
  return conversations;
}

@Injectable()
export class DashboardService {
  aggregate(input: DashboardAggregateInput): DashboardAggregate {
    return aggregateDashboard(input);
  }
}

// Keep imports referenced so RED compiles with journal helpers available for GREEN.
void isCdrUnrestricted;
void normalizeAccessToken;
void UserLevel;
void isJournalRowVisible;
void filterDashboardByAccess;
