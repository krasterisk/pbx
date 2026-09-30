/**
 * After the text is accepted, attach real recording ids.
 * The model never supplies these ids.
 */

import type { DashboardCall } from './dashboard.service';
import {
  findExemplarRecordingIds,
  findRecordingIdsForDistribution,
  findRecordingIdsForTag,
} from './dashboard-drill';
import type { SaInsight } from './insights.service';

function scored(calls: DashboardCall[]): DashboardCall[] {
  return calls.filter((call) => !call.lowStt);
}

function byOperators(calls: DashboardCall[], operators: string[]): DashboardCall[] {
  const name = operators[0]?.trim().toLowerCase();
  if (!name) return calls;
  return calls.filter((call) => (call.operatorName ?? '').toLowerCase().includes(name));
}

export function attachInsightRecordingIds(insights: SaInsight[], calls: DashboardCall[]): SaInsight[] {
  const pool = scored(calls);
  const topicNames = new Set(pool.flatMap((call) => call.topics));
  return insights.map((insight) => {
    const metric = insight.evidence.metric.trim();
    const narrowed = byOperators(pool, insight.evidence.operators);
    let recordingIds: string[] = [];
    if (metric === 'sentiment' || metric === 'customer_sentiment') {
      const sentiment = insight.type === 'strength' ? 'positive' : 'negative';
      recordingIds = findRecordingIdsForDistribution(narrowed, { sentiment }).slice(0, 5);
    } else if (metric === 'success' || metric === 'scenario_success' || metric === 'successPct' || metric === 'successRate') {
      recordingIds = findRecordingIdsForDistribution(narrowed, { success: insight.type === 'strength' }).slice(0, 5);
    } else if (metric && topicNames.has(metric)) {
      recordingIds = findRecordingIdsForTag(narrowed, metric).slice(0, 5);
    } else {
      recordingIds = findExemplarRecordingIds(narrowed, {
        metric,
        operators: insight.evidence.operators,
      }, insight.type);
    }
    return {
      ...insight,
      evidence: { ...insight.evidence, recordingIds },
    };
  });
}
