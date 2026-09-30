import {
  defaultSaProjectConfig,
  resolveProjectInsights,
  rubricForMetric,
  normalizeProjectMetric,
  type SaCallTagDef,
  type SaCustomMetricDef,
  type SaProjectConfigV1,
  type SaProjectMetric,
} from '@krasterisk/shared';

export const PROMPT_VERSION = '2026-09-22.1';

const GLOBAL_SCORING = [
  'Scores: 0|25|50|75|100 only (0=absent, 25=poor, 50=adequate, 75=good, 100=all checklist items present).',
  'Give 100 when every checklist item is clearly present (synonyms OK). Below 100: name the missing item.',
  'PROCESS vs OUTCOME: Score checklist behavior, not whether the customer got their preferred outcome.',
  'CSAT and sentiment rate the customer reaction to the OPERATOR, not to a business limit.',
  'LANGUAGE: prose in the transcript language. JSON keys and enums Positive/Neutral/Negative stay English.',
].join('\n');

export type AnalysisMetricValue = number | boolean | string | string[] | null;

function flattenMetricValue(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string' || Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('value' in obj) return flattenMetricValue(obj.value);
    if ('score' in obj) return flattenMetricValue(obj.score);
  }
  return null;
}

/** Pull a score out of a bare value, a numeric string, or {value|score}. */
export function coerceMetricValue(raw: unknown, type: string): AnalysisMetricValue {
  const flat = flattenMetricValue(raw);
  if (flat == null || flat === '') return null;
  if (type === 'number') {
    const n = typeof flat === 'number' ? flat : Number(String(flat).trim());
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') {
    if (typeof flat === 'boolean') return flat;
    if (flat === 'true' || flat === 1) return true;
    if (flat === 'false' || flat === 0) return false;
    return null;
  }
  if (typeof flat === 'string' || typeof flat === 'number' || typeof flat === 'boolean') return flat;
  if (Array.isArray(flat)) return flat.map((item) => String(item));
  return null;
}

export type AnalysisMetricRow = {
  id: string;
  value: AnalysisMetricValue;
  rationale: string;
  quote: string;
};

export type AnalysisScore = {
  summary: string;
  customerSentiment: string;
  csat: number;
  success: boolean;
  metrics: AnalysisMetricRow[];
  topicTagIds: string[];
  assessments: Record<string, { rationale?: string; quote?: string }>;
};

function customAsMetric(metric: SaCustomMetricDef): SaProjectMetric {
  return normalizeProjectMetric({
    id: metric.id,
    name: metric.name,
    type: metric.type,
    description: metric.description ?? '',
    enumValues: metric.enumValues,
    min: metric.min,
    max: metric.max,
    unit: metric.unit,
    polarity: metric.polarity,
  });
}

/**
 * Metrics the model must score. Summary, sentiment, CSAT and success are always
 * requested separately. Standard scales are included only when this project
 * still lists them and has not hidden them.
 */
export function scoringMetrics(config: SaProjectConfigV1): SaProjectMetric[] {
  const hidden = new Set(config.hiddenDefaultScales ?? []);
  const visible = (config.metrics ?? [])
    .map((metric) => normalizeProjectMetric(metric))
    .filter((metric) => metric.id && metric.name && !hidden.has(metric.id));
  const seen = new Set(visible.map((metric) => metric.id));
  for (const metric of config.customMetrics ?? []) {
    if (!metric.id || !metric.name || hidden.has(metric.id) || seen.has(metric.id)) continue;
    visible.push(customAsMetric(metric));
    seen.add(metric.id);
  }
  return visible;
}

/** Saved project config. Missing metric lists stay empty and do not inherit the builtin scales. */
export function configForAnalysis(raw: Partial<SaProjectConfigV1> | null | undefined): SaProjectConfigV1 {
  const base = defaultSaProjectConfig();
  const parsed = raw ?? {};
  return {
    ...base,
    ...parsed,
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    customMetrics: Array.isArray(parsed.customMetrics) ? parsed.customMetrics : [],
    hiddenDefaultScales: Array.isArray(parsed.hiddenDefaultScales) ? parsed.hiddenDefaultScales : [],
    callTaxonomy: Array.isArray(parsed.callTaxonomy) ? parsed.callTaxonomy : [],
    systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
    insightsFocus: typeof parsed.insightsFocus === 'string' ? parsed.insightsFocus.trim().slice(0, 2000) : '',
  };
}

function topicSkill(tags: SaCallTagDef[]): string {
  const listed = tags.filter((tag) => tag.id && tag.name?.trim());
  if (!listed.length) return '';
  const lines = listed.map((tag) => {
    const when = tag.description?.trim() || 'ставь по смыслу названия';
    const hints = tag.aliases?.length ? ` Подсказки: ${tag.aliases.join(', ')}.` : '';
    return `- ${tag.id} "${tag.name.trim()}": ${when}.${hints}`;
  });
  return [
    'CALL TOPIC TAGGING:',
    'Отдельная задача, не метрика. Верни topic_tag_ids: ноль, один или несколько id из списка.',
    'Ставь каждый тег, который действительно подходит. Не ставь тег "на всякий случай". Чужие id запрещены.',
    ...lines,
  ].join('\n');
}

export function buildAnalysisPrompt(config: SaProjectConfigV1, transcript: string): string {
  const insights = resolveProjectInsights(config);
  const metrics = scoringMetrics(config);
  const lines = metrics.map((m) => {
    const rubric = rubricForMetric(m);
    const range = m.type === 'number'
      ? ` range ${m.min ?? 0}-${m.max ?? 100}`
      : '';
    const enums = m.type === 'enum' && m.enumValues?.length
      ? ` enum ${m.enumValues.join('|')}`
      : '';
    return `- ${m.id} (${m.name}, ${m.type}${range}${enums}): ${rubric}`;
  });
  const tones = insights.sentiment.enabled
    ? insights.sentiment.values
      .map((row) => `- ${row.id} "${row.name}": ${row.description || row.name}`)
      .join('\n')
    : '';
  const required: string[] = [];
  const assessmentKeys: string[] = [];
  if (insights.summary.enabled) {
    required.push(`summary (string, transcript language): ${insights.summary.instruction}`);
    assessmentKeys.push('summary');
  }
  if (insights.csat.enabled) {
    required.push(`csat (integer ${insights.csat.min}-${insights.csat.max}; ${insights.csat.min}=${insights.csat.lowLabel}; ${insights.csat.max}=${insights.csat.highLabel}): ${insights.csat.instruction}`);
    assessmentKeys.push('csat');
  }
  if (insights.sentiment.enabled) {
    required.push(`customer_sentiment (one of ${insights.sentiment.values.map((row) => row.id).join('|')}): ${insights.sentiment.instruction}`);
    assessmentKeys.push('customer_sentiment');
  }
  if (insights.success.enabled) {
    required.push(`success (boolean): ${insights.success.instruction}`);
    assessmentKeys.push('success');
  }
  return [
    'Call center QA analyzer. JSON only.',
    GLOBAL_SCORING,
    config.systemPrompt ? `BUSINESS CONTEXT:\n${config.systemPrompt}` : '',
    required.length ? 'ALWAYS RETURN:' : '',
    ...required,
    tones,
    assessmentKeys.length
      ? `assessments.${assessmentKeys.join(', assessments.')} are {rationale, quote}.`
      : '',
    'PROJECT METRICS:',
    lines.join('\n') || '- none',
    'Do not add metrics that are not listed above.',
    'For every listed metric the JSON must contain a top-level key equal to the metric id, and assessments[id] = {"value": the same score, "rationale": "...", "quote": "..."}.',
    'Number metrics use 0|25|50|75|100 unless a range is given. Never omit value. Never put the score only in the rationale text.',
    topicSkill(config.callTaxonomy ?? []),
    'TRANSCRIPTION:',
    transcript,
  ].filter(Boolean).join('\n\n');
}

function readSuccessFlag(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  if (value && typeof value === 'object' && 'value' in value) {
    return readSuccessFlag((value as { value: unknown }).value);
  }
  return null;
}

function asSentiment(value: unknown, allowed: Set<string>): string {
  const raw = String(value ?? '').trim();
  if (allowed.has(raw)) return raw;
  const folded = raw.toLowerCase();
  for (const id of allowed) {
    if (id.toLowerCase() === folded) return id;
  }
  return allowed.has('Neutral') ? 'Neutral' : [...allowed][0] ?? 'Neutral';
}

function assessmentNote(
  assessments: Record<string, { rationale?: string; quote?: string }>,
  id: string,
): { rationale: string; quote: string } {
  const row = assessments[id] ?? {};
  return {
    rationale: String(row.rationale ?? ''),
    quote: String(row.quote ?? ''),
  };
}

export function analysisToMetricRows(
  score: AnalysisScore,
  assessments: Record<string, { rationale?: string; quote?: string }> = {},
  insights = resolveProjectInsights(null),
): AnalysisMetricRow[] {
  const rows: AnalysisMetricRow[] = [...score.metrics];
  if (insights.sentiment.enabled) {
    rows.push({
      id: 'customer_sentiment',
      value: score.customerSentiment,
      ...assessmentNote(assessments, 'customer_sentiment'),
    });
  }
  if (insights.csat.enabled) {
    rows.push({
      id: 'csat',
      value: score.csat,
      ...assessmentNote(assessments, 'csat'),
    });
  }
  if (insights.success.enabled) {
    rows.push({
      id: 'success',
      value: score.success,
      ...assessmentNote(assessments, 'success'),
    });
  }
  rows.push({ id: 'topics', value: score.topicTagIds, rationale: '', quote: '' });
  return rows;
}

/** First balanced object that parses. Skips prose fragments such as {rationale, quote}. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? raw;
  const found: Record<string, unknown>[] = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const start = source.indexOf('{', searchFrom);
    if (start < 0) break;
    const end = matchingJsonBrace(source, start);
    if (end < 0) {
      searchFrom = start + 1;
      continue;
    }
    const slice = source.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    try {
      const parsed = JSON.parse(slice) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        found.push(parsed as Record<string, unknown>);
      }
    } catch {
      /* look for the next object */
    }
    searchFrom = start + 1;
  }
  if (found.length === 0) return null;
  return found.sort((left, right) => jsonObjectScore(right) - jsonObjectScore(left))[0];
}

function jsonObjectScore(body: Record<string, unknown>): number {
  let score = Object.keys(body).length;
  if ('summary' in body) score += 20;
  if ('assessments' in body) score += 20;
  if ('csat' in body || 'customer_sentiment' in body) score += 10;
  if ('metrics' in body || 'roles' in body) score += 10;
  return score;
}

function matchingJsonBrace(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function parseAnalysisResponse(raw: string, config: SaProjectConfigV1): AnalysisScore {
  const body = parseJsonObject(raw);
  if (!body) {
    const sample = raw.replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(`score response has no JSON object sample=${sample}`);
  }
  const insights = resolveProjectInsights(config);
  const allowedSentiment = new Set(insights.sentiment.values.map((row) => row.id));
  const allowedTags = new Set((config.callTaxonomy ?? []).filter((tag) => tag.id && tag.name?.trim()).map((t) => t.id));
  const topicRaw = Array.isArray(body.topic_tag_ids) ? body.topic_tag_ids : [];
  const topicTagIds = topicRaw
    .filter((id): id is string => typeof id === 'string' && allowedTags.has(id))
    .slice(0, 10);
  const assessments = (body.assessments && typeof body.assessments === 'object')
    ? body.assessments as Record<string, { value?: unknown; score?: unknown; rationale?: string; quote?: string }>
    : {};
  const custom = (body.custom_metrics && typeof body.custom_metrics === 'object')
    ? body.custom_metrics as Record<string, unknown>
    : {};
  const listed = Array.isArray(body.metrics) ? body.metrics : [];
  const byId = new Map<string, { value?: unknown; rationale?: unknown; quote?: unknown }>();
  for (const row of listed) {
    if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
      byId.set((row as { id: string }).id, row as { value?: unknown; rationale?: unknown; quote?: unknown });
    }
  }
  const scores = (body.scores && typeof body.scores === 'object')
    ? body.scores as Record<string, unknown>
    : {};
  const metrics = scoringMetrics(config).map((m) => {
    const fromList = byId.get(m.id);
    const fromCustom = custom[m.id];
    const fromTop = body[m.id];
    const fromScores = scores[m.id];
    const note = assessments[m.id];
    const noteObj = note && typeof note === 'object' ? note : {};
    const candidates = [fromCustom, fromTop, fromScores, fromList?.value, note];
    let value: AnalysisMetricValue = null;
    for (const candidate of candidates) {
      const coerced = coerceMetricValue(candidate, m.type);
      if (coerced != null) {
        value = coerced;
        break;
      }
    }
    return {
      id: m.id,
      value,
      rationale: String(noteObj.rationale ?? fromList?.rationale ?? ''),
      quote: String(noteObj.quote ?? fromList?.quote ?? ''),
    };
  });
  const csatNum = Number(body.csat);
  const csatFallback = Math.round((insights.csat.min + insights.csat.max) / 2);
  return {
    summary: insights.summary.enabled ? String(body.summary ?? '') : '',
    customerSentiment: asSentiment(body.customer_sentiment, allowedSentiment),
    csat: Number.isFinite(csatNum)
      ? Math.min(insights.csat.max, Math.max(insights.csat.min, Math.round(csatNum)))
      : csatFallback,
    success: readSuccessFlag(body.success) ?? readSuccessFlag(assessments.success) ?? false,
    metrics,
    topicTagIds,
    assessments,
  };
}
