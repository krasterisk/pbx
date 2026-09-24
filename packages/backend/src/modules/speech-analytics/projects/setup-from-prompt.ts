import type { SaCallTagDef, SaMetricPolarity, SaProjectMetric } from '@krasterisk/shared';

const TYPES = new Set(['boolean', 'number', 'enum', 'string']);
const POLARITY = new Set<SaMetricPolarity>(['positive', 'negative', 'neutral']);

function slug(name: string, fallback: string): string {
  const id = name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_|_$/g, '');
  return id.slice(0, 64) || fallback;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

export type SetupFromPromptResult = {
  metrics: SaProjectMetric[];
  topics: SaCallTagDef[];
};

/** Pull metrics and call topics from the model's JSON answer. */
export function parseSetupFromPrompt(raw: string): SetupFromPromptResult {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('setup_json');
  const parsed = JSON.parse(text.slice(start, end + 1)) as { metrics?: unknown; topics?: unknown };
  const metricUsed = new Set<string>();
  const metrics: SaProjectMetric[] = [];
  for (const row of Array.isArray(parsed.metrics) ? parsed.metrics : []) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name ?? '').trim();
    if (!name) continue;
    const typeRaw = String(item.type ?? 'number');
    const type = (TYPES.has(typeRaw) ? typeRaw : 'number') as SaProjectMetric['type'];
    const metric: SaProjectMetric = {
      id: uniqueId(slug(String(item.id ?? name), slug(name, 'metric')), metricUsed),
      name,
      type,
      description: String(item.description ?? '').trim(),
      sourceScaleId: null,
    };
    if (type === 'enum' && Array.isArray(item.enumValues)) {
      metric.enumValues = item.enumValues.map((value) => String(value).trim()).filter(Boolean);
    }
    if (type === 'number') {
      const min = Number(item.min);
      const max = Number(item.max);
      metric.min = Number.isFinite(min) ? min : 0;
      metric.max = Number.isFinite(max) ? max : 100;
      if (typeof item.unit === 'string' && item.unit.trim()) metric.unit = item.unit.trim();
      const polarity = String(item.polarity ?? 'positive') as SaMetricPolarity;
      metric.polarity = POLARITY.has(polarity) ? polarity : 'positive';
    }
    metrics.push(metric);
  }
  const topicUsed = new Set<string>();
  const topics: SaCallTagDef[] = [];
  for (const row of Array.isArray(parsed.topics) ? parsed.topics : []) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name ?? '').trim();
    if (!name) continue;
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.map((value) => String(value).trim()).filter(Boolean)
      : [];
    topics.push({
      id: uniqueId(slug(String(item.id ?? name), slug(name, 'topic')), topicUsed),
      name,
      description: String(item.description ?? '').trim(),
      aliases,
    });
  }
  return { metrics, topics };
}
