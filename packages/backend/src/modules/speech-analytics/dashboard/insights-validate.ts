/**
 * A card may cite only numbers that the fact pack already contains.
 * A foreign number drops the card. The model does not get to keep the sentence.
 */

import type { SaInsight, InsightType } from './insights.service';

const TYPES = new Set<InsightType>(['strength', 'gap', 'trend', 'outlier', 'quality']);
const PRIORITIES = new Set(['high', 'medium', 'low']);
const NUMBER_RE = /\d+(?:[.,]\d+)?/g;

export function factNumberKeys(facts: unknown): Set<string> {
  const keys = new Set<string>();
  const add = (value: number) => {
    if (!Number.isFinite(value)) return;
    keys.add(numberKey(value));
    keys.add(String(Math.trunc(value)));
  };
  const walk = (value: unknown) => {
    if (typeof value === 'number') {
      add(value);
      return;
    }
    if (typeof value === 'string') {
      for (const item of value.match(NUMBER_RE) ?? []) add(Number(item.replace(',', '.')));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(facts);
  return keys;
}

function numberKey(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function numberAllowed(value: number, allowed: Set<string>): boolean {
  return allowed.has(numberKey(value)) || allowed.has(String(Math.trunc(value)));
}

function proseNumbers(text: string): number[] {
  return (text.match(NUMBER_RE) ?? []).map((item) => Number(item.replace(',', '.')));
}

export function insightMatchesFacts(insight: SaInsight, allowed: Set<string>): boolean {
  const cited = [
    ...proseNumbers(insight.title),
    ...proseNumbers(insight.observation),
    ...proseNumbers(insight.recommendation),
  ];
  if (insight.evidence.value != null) cited.push(insight.evidence.value);
  if (cited.length === 0) return false;
  return cited.every((value) => Number.isFinite(value) && numberAllowed(value, allowed));
}

export function sanitizeInsights(insights: SaInsight[], facts: unknown): SaInsight[] {
  const allowed = factNumberKeys(facts);
  return insights
    .filter((insight) => insightMatchesFacts(insight, allowed))
    .map((insight) => ({
      ...insight,
      evidence: {
        metric: insight.evidence.metric,
        value: insight.evidence.value,
        operators: insight.evidence.operators,
        periodLabel: insight.evidence.periodLabel,
      },
    }));
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOne(row: unknown): SaInsight | null {
  if (!row || typeof row !== 'object') return null;
  const source = row as Record<string, unknown>;
  const type = asText(source.type) as InsightType;
  const priority = asText(source.priority);
  if (!TYPES.has(type) || !PRIORITIES.has(priority)) return null;
  const title = asText(source.title);
  const observation = asText(source.observation);
  const recommendation = asText(source.recommendation);
  if (!title || !observation || !recommendation) return null;
  const evidence = source.evidence && typeof source.evidence === 'object'
    ? source.evidence as Record<string, unknown>
    : {};
  const rawValue = evidence.value;
  const value = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
  const operators = Array.isArray(evidence.operators)
    ? evidence.operators.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()).slice(0, 5)
    : [];
  return {
    type,
    priority: priority as SaInsight['priority'],
    title,
    observation,
    recommendation,
    evidence: {
      metric: asText(evidence.metric),
      value,
      operators,
      periodLabel: asText(evidence.periodLabel),
    },
  };
}

export function parseInsightsPayload(raw: string): { ok: true; insights: SaInsight[] } | { ok: false; error: string } {
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return { ok: false, error: 'Response is not JSON.' };
    try {
      body = JSON.parse(raw.slice(start, end + 1)) as unknown;
    } catch {
      return { ok: false, error: 'Response is not JSON.' };
    }
  }
  if (!body || typeof body !== 'object' || !Array.isArray((body as { insights?: unknown }).insights)) {
    return { ok: false, error: 'JSON must contain an insights array.' };
  }
  const listed = (body as { insights: unknown[] }).insights;
  if (listed.length < 1 || listed.length > 6) {
    return { ok: false, error: 'insights length must be from 1 to 6.' };
  }
  const insights: SaInsight[] = [];
  for (const row of listed) {
    const parsed = parseOne(row);
    if (!parsed) return { ok: false, error: 'An insight is missing type, priority, Russian text, or evidence.' };
    insights.push(parsed);
  }
  return { ok: true, insights };
}
