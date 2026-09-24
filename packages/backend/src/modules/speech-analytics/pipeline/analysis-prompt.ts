import {
  rubricForMetric,
  type SaCallTagDef,
  type SaProjectConfigV1,
  type SaProjectMetric,
} from '@krasterisk/shared';

export const PROMPT_VERSION = '2026-09-22.1';

const GLOBAL_SCORING = [
  'Scores: 0|25|50|75|100 only (0=absent, 25=poor, 50=adequate, 75=good, 100=all checklist items present).',
  'Give 100 when every checklist item is clearly present (synonyms OK). Below 100: name the missing item.',
  'PROCESS vs OUTCOME: Score checklist behavior, not whether the customer got their preferred outcome.',
  'SUCCESS: true when the operator handled the request correctly within company scope, including a clear business limit plus a next step. success=false only for operator-caused failure.',
  'CSAT and sentiment rate the customer reaction to the OPERATOR, not to a business limit.',
  'LANGUAGE: prose in the transcript language. JSON keys and enums Positive/Neutral/Negative stay English.',
].join('\n');

export type AnalysisScore = {
  summary: string;
  customerSentiment: 'Positive' | 'Neutral' | 'Negative';
  csat: number;
  success: boolean;
  metrics: Array<{ id: string; value: number | boolean | string | null; rationale: string; quote: string }>;
  topicTagIds: string[];
};

export function scoringMetrics(config: SaProjectConfigV1): SaProjectMetric[] {
  return (config.metrics ?? []).filter((m) => m.id && m.name);
}

export function buildAnalysisPrompt(config: SaProjectConfigV1, transcript: string): string {
  const metrics = scoringMetrics(config);
  const lines = metrics.map((m) => {
    const rubric = rubricForMetric(m);
    const range = m.type === 'number' || m.type === 'scale'
      ? ` range ${m.min ?? 0}-${m.max ?? 100}`
      : '';
    const enums = m.type === 'enum' && m.enumValues?.length
      ? ` enum ${m.enumValues.join('|')}`
      : '';
    return `- ${m.id} (${m.name}, ${m.type}${range}${enums}): ${rubric}`;
  });
  const tags = (config.callTaxonomy ?? []).map((t: SaCallTagDef) => (
    `- ${t.id}: ${t.name}. ${t.description ?? ''} Aliases: ${(t.aliases ?? []).join(', ')}`
  ));
  return [
    'Call center QA analyzer. JSON only.',
    GLOBAL_SCORING,
    config.systemPrompt ? `BUSINESS CONTEXT:\n${config.systemPrompt}` : '',
    'METRICS:',
    lines.join('\n') || '- none',
    tags.length ? `TOPICS (return ids only):\n${tags.join('\n')}` : '',
    'Also return summary, customer_sentiment (Positive|Neutral|Negative), csat (1-5), success (boolean), and for every metric rationale + quote.',
    'TRANSCRIPTION:',
    transcript,
  ].filter(Boolean).join('\n\n');
}

function asSentiment(value: unknown): AnalysisScore['customerSentiment'] {
  if (value === 'Positive' || value === 'Negative' || value === 'Neutral') return value;
  return 'Neutral';
}

export function analysisToMetricRows(score: AnalysisScore): AnalysisScore['metrics'] {
  return [
    ...score.metrics,
    { id: 'customer_sentiment', value: score.customerSentiment, rationale: '', quote: '' },
    { id: 'csat', value: score.csat, rationale: '', quote: '' },
    { id: 'success', value: score.success, rationale: '', quote: '' },
    { id: 'topics', value: score.topicTagIds.join(', '), rationale: '', quote: '' },
  ];
}

export function parseAnalysisResponse(raw: string, config: SaProjectConfigV1): AnalysisScore {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : '{}';
  const body = JSON.parse(json) as Record<string, unknown>;
  const allowedTags = new Set((config.callTaxonomy ?? []).map((t) => t.id));
  const topicRaw = Array.isArray(body.topic_tag_ids) ? body.topic_tag_ids : [];
  const topicTagIds = topicRaw
    .filter((id): id is string => typeof id === 'string' && allowedTags.has(id))
    .slice(0, 10);
  const assessments = (body.assessments && typeof body.assessments === 'object')
    ? body.assessments as Record<string, { rationale?: string; quote?: string }>
    : {};
  const custom = (body.custom_metrics && typeof body.custom_metrics === 'object')
    ? body.custom_metrics as Record<string, unknown>
    : {};
  const metrics = scoringMetrics(config).map((m) => {
    const fromCustom = custom[m.id];
    const fromTop = body[m.id];
    const value = (fromCustom ?? fromTop ?? null) as number | boolean | string | null;
    const note = assessments[m.id] ?? {};
    return {
      id: m.id,
      value: value === undefined ? null : value,
      rationale: String(note.rationale ?? ''),
      quote: String(note.quote ?? ''),
    };
  });
  const csatNum = Number(body.csat);
  return {
    summary: String(body.summary ?? ''),
    customerSentiment: asSentiment(body.customer_sentiment),
    csat: Number.isFinite(csatNum) ? Math.min(5, Math.max(1, Math.round(csatNum))) : 3,
    success: body.success === true,
    metrics,
    topicTagIds,
  };
}
