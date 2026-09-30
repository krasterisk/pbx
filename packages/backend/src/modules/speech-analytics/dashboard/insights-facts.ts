/**
 * Numbers the insights model is allowed to mention.
 * The model narrates this pack. It does not choose the comparison window.
 */

import { createHash } from 'node:crypto';
import type { DashboardAggregate, DashboardCall } from './dashboard.service';
import { readMetricValue } from './dashboard-drill';

export const INSIGHTS_MIN_CONVERSATIONS = 10;
export const INSIGHTS_OPERATOR_MIN_CALLS = 3;
export const INSIGHTS_SKILL_VERSION = '2026-09-30.1';

export type InsightsFactNumber = {
  current: number | null;
  previous: number | null;
  delta: number | null;
};

export type InsightsOperatorMetric = {
  name: string;
  avg: number;
  calls: number;
};

export type InsightsFactPack = {
  period: {
    currentLabel: string;
    previousLabel: string | null;
    comparable: boolean;
    comparisonNote: string | null;
  };
  summary: {
    calls: InsightsFactNumber;
    score: InsightsFactNumber;
    successPct: InsightsFactNumber;
    ahtSec: InsightsFactNumber;
    cost: InsightsFactNumber;
    sentiment: {
      positive: InsightsFactNumber;
      neutral: InsightsFactNumber;
      negative: InsightsFactNumber;
    };
  };
  metrics: Array<{
    id: string;
    label: string;
    avg: number;
    previousAvg: number | null;
    delta: number | null;
    worseOperators: InsightsOperatorMetric[];
    betterOperators: InsightsOperatorMetric[];
  }>;
  topics: {
    current: Array<{ label: string; count: number }>;
    grew: Array<{ label: string; current: number; previous: number; delta: number }>;
    faded: Array<{ label: string; current: number; previous: number; delta: number }>;
  };
  mismatch: {
    successfulNegative: number;
    unsuccessfulCalm: number;
  };
  quotes: Array<{
    metricId: string;
    operator: string | null;
    text: string;
    recordingId: string;
    score: number | null;
  }>;
};

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function num(value: number | null | undefined, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundTo(value, digits);
}

function fact(current: number | null, previous: number | null, comparable: boolean, digits: number): InsightsFactNumber {
  const left = num(current, digits);
  const right = comparable ? num(previous, digits) : null;
  return {
    current: left,
    previous: right,
    delta: comparable && left != null && right != null ? roundTo(left - right, digits) : null,
  };
}

function percent(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return roundTo(rate * 100, 1);
}

function seconds(durationMs: number | null | undefined): number | null {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return Math.round(durationMs / 1000);
}

function money(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundTo(parsed, 2) : null;
}

function scoredCalls(calls: DashboardCall[]): DashboardCall[] {
  return calls.filter((call) => !call.lowStt);
}

function operatorMetrics(calls: DashboardCall[], metricId: string, projectAvg: number): {
  worseOperators: InsightsOperatorMetric[];
  betterOperators: InsightsOperatorMetric[];
} {
  const groups = new Map<string, number[]>();
  for (const call of scoredCalls(calls)) {
    const name = call.operatorName?.trim();
    if (!name) continue;
    const value = readMetricValue(call, metricId);
    if (value == null) continue;
    const list = groups.get(name) ?? [];
    list.push(value);
    groups.set(name, list);
  }
  const ranked = [...groups.entries()]
    .filter(([, values]) => values.length >= INSIGHTS_OPERATOR_MIN_CALLS)
    .map(([name, values]) => ({
      name,
      calls: values.length,
      avg: roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 2),
    }));
  const worseOperators = ranked
    .filter((row) => row.avg < projectAvg)
    .sort((left, right) => left.avg - right.avg || right.calls - left.calls)
    .slice(0, 3);
  const betterOperators = ranked
    .filter((row) => row.avg > projectAvg)
    .sort((left, right) => right.avg - left.avg || right.calls - left.calls)
    .slice(0, 3);
  return { worseOperators, betterOperators };
}

function mismatch(calls: DashboardCall[]): InsightsFactPack['mismatch'] {
  let successfulNegative = 0;
  let unsuccessfulCalm = 0;
  for (const call of scoredCalls(calls)) {
    if (call.success === true && call.sentiment === 'negative') successfulNegative += 1;
    if (call.success === false && (call.sentiment === 'positive' || call.sentiment === 'neutral')) {
      unsuccessfulCalm += 1;
    }
  }
  return { successfulNegative, unsuccessfulCalm };
}

function quotes(calls: DashboardCall[]): InsightsFactPack['quotes'] {
  const rows: InsightsFactPack['quotes'] = [];
  const ranked = [...scoredCalls(calls)].sort((left, right) => (left.score ?? 999) - (right.score ?? 999));
  for (const call of ranked) {
    for (const metric of call.metrics) {
      const text = metric.rationale.trim();
      if (!text || typeof metric.value !== 'number') continue;
      rows.push({
        metricId: metric.id,
        operator: call.operatorName?.trim() || null,
        text: text.slice(0, 180),
        recordingId: call.id,
        score: roundTo(metric.value, 2),
      });
      if (rows.length >= 6) return rows;
    }
  }
  return rows;
}

export function buildInsightsFacts(
  current: DashboardAggregate,
  previous: DashboardAggregate | null,
  labels: { currentLabel: string; previousLabel: string },
): InsightsFactPack {
  const comparable = previous != null && previous.conversationCount >= INSIGHTS_MIN_CONVERSATIONS;
  const previousMetrics = new Map((previous?.metrics ?? []).map((metric) => [metric.id, metric.avg]));
  const previousTopics = new Map((previous?.topics ?? []).map((topic) => [topic.label, topic.count]));
  const topicRows = comparable
    ? current.topics.map((topic) => ({
      label: topic.label,
      current: topic.count,
      previous: previousTopics.get(topic.label) ?? 0,
      delta: topic.count - (previousTopics.get(topic.label) ?? 0),
    }))
    : [];
  for (const [label, count] of previousTopics) {
    if (!comparable || current.topics.some((topic) => topic.label === label)) continue;
    topicRows.push({ label, current: 0, previous: count, delta: -count });
  }
  return {
    period: {
      currentLabel: labels.currentLabel,
      previousLabel: comparable ? labels.previousLabel : null,
      comparable,
      comparisonNote: comparable
        ? null
        : 'Сравнить не с чем: в прошлом периоде меньше 10 разговоров. Опиши только текущий период и не называй это трендом.',
    },
    summary: {
      calls: fact(current.conversationCount, previous?.conversationCount ?? null, comparable, 0),
      score: fact(current.averageScore, previous?.averageScore ?? null, comparable, 2),
      successPct: fact(percent(current.successRate), percent(previous?.successRate), comparable, 1),
      ahtSec: fact(seconds(current.averageDurationMs), seconds(previous?.averageDurationMs), comparable, 0),
      cost: fact(money(current.costTotal), money(previous?.costTotal), comparable, 2),
      sentiment: {
        positive: fact(current.sentiment.positive, previous?.sentiment.positive ?? null, comparable, 0),
        neutral: fact(current.sentiment.neutral, previous?.sentiment.neutral ?? null, comparable, 0),
        negative: fact(current.sentiment.negative, previous?.sentiment.negative ?? null, comparable, 0),
      },
    },
    metrics: current.metrics.map((metric) => {
      const avg = roundTo(metric.avg, 2);
      const previousAvg = comparable && previousMetrics.has(metric.id)
        ? roundTo(previousMetrics.get(metric.id) ?? 0, 2)
        : null;
      return {
        id: metric.id,
        label: metric.label,
        avg,
        previousAvg,
        delta: previousAvg == null ? null : roundTo(avg - previousAvg, 2),
        ...operatorMetrics(current.calls, metric.id, avg),
      };
    }),
    topics: {
      current: current.topics.slice(0, 8).map((topic) => ({ label: topic.label, count: topic.count })),
      grew: topicRows
        .filter((topic) => topic.delta > 0)
        .sort((left, right) => right.delta - left.delta || right.current - left.current)
        .slice(0, 5),
      faded: topicRows
        .filter((topic) => topic.previous >= 2 && topic.current * 2 <= topic.previous)
        .sort((left, right) => left.delta - right.delta)
        .slice(0, 5),
    },
    mismatch: mismatch(current.calls),
    quotes: quotes(current.calls),
  };
}

export function insightsCacheKey(input: {
  tenantUid: number;
  projectId: string;
  from: string;
  to: string;
  facts: unknown;
  insightsFocus: string;
}): string {
  return createHash('sha256').update(JSON.stringify({
    tenantUid: input.tenantUid,
    projectId: input.projectId,
    from: input.from,
    to: input.to,
    skillVersion: INSIGHTS_SKILL_VERSION,
    insightsFocus: input.insightsFocus,
    facts: input.facts,
  })).digest('hex');
}
