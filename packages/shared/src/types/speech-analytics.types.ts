export const SA_RUBRIC_VERSION = 'sa-metrics-v1' as const;
export const SA_METRICS = ['greeting_present', 'next_step_agreed', 'topic'] as const;
export type SaMetricId = typeof SA_METRICS[number];

export const SA_METRIC_STATUSES = ['scored', 'unknown', 'not_applicable', 'unscorable'] as const;
export type SaMetricStatus = typeof SA_METRIC_STATUSES[number];

export const SA_TOPICS = ['sales', 'support', 'other'] as const;
export type SaTopic = typeof SA_TOPICS[number];

export type SaMetricEvidence = {
  segmentId: string;
  startMs: number;
  endMs: number;
};

export type SaMetricResult = {
  id: SaMetricId;
  status: SaMetricStatus;
  value: boolean | SaTopic | null;
  evidence: SaMetricEvidence[];
  rationale: string;
  rubricRevision: typeof SA_RUBRIC_VERSION;
};

export const SA_RUN_STATES = [
  'queued', 'running', 'retry_wait', 'awaiting_reconciliation',
  'partial', 'completed', 'failed', 'cancelled',
] as const;
export type SaRunState = typeof SA_RUN_STATES[number];

/** Industry templates for the metric editor (D-25). */
export const SA_INDUSTRY_TEMPLATES = [
  'real_estate',
  'delivery',
  'tech_support',
  'banking',
  'medicine',
  'food',
  'auto_service',
  'insurance',
  'ecommerce',
  'custom',
] as const;
export type SaIndustryTemplateId = typeof SA_INDUSTRY_TEMPLATES[number];

export const SA_DEFAULT_SCALES = [
  'greeting_quality',
  'politeness_empathy',
  'active_listening',
  'objection_handling',
  'product_knowledge',
  'closing_quality',
  'script_compliance',
  'speech_clarity_pace',
  'problem_resolution',
] as const;
export type SaDefaultScaleId = typeof SA_DEFAULT_SCALES[number];

export const SA_WEBHOOK_EVENTS = [
  'analysis.completed',
  'analysis.error',
  'budget.exceeded',
  'anomaly.detected',
] as const;
export type SaWebhookEvent = typeof SA_WEBHOOK_EVENTS[number];

export type SaCustomMetricDef = {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'enum';
  description?: string;
  enumValues?: string[];
};

export type SaEventWebhookConfig = {
  url: string | null;
  headers: Record<string, string>;
  events: SaWebhookEvent[];
};

export type SaDigestConfig = {
  enabled: boolean;
  /** NotificationIntegrationsPage uids for this tenant (D-29). */
  integrationUids: number[];
  schedule: 'daily' | 'weekly' | 'monthly';
  reportWindow: 'last_7_days' | 'last_30_days' | 'previous_calendar_month';
  weeklyDay?: number;
  monthlyDay?: number;
  sendHour?: number;
};

export type SaAlertConfig = {
  enabled: boolean;
  /** NotificationIntegrationsPage uids for this tenant (D-29). */
  integrationUids: number[];
  csatDrop: { enabled: boolean; dropPct: number; windowDays: number; minCalls: number };
  negativeSpike: { enabled: boolean; spikePp: number; windowDays: number; minCalls: number };
  budgetExceeded: { enabled: boolean };
};

export type SaBudgetConfig = {
  /** Soft limit in cabinet currency; 0 = no limit (D-28). */
  softLimit: number;
};

export type SaProjectConfigV1 = {
  schemaVersion: 1;
  language: string;
  sttRevisionId: string;
  llmRevisionId: string;
  rubricVersion: typeof SA_RUBRIC_VERSION;
  maxBytes: number;
  maxDurationMs: number;
  fallbackProviders: string[];
  retentionRef: string;
  /** Editor sections (D-25). */
  templateId: SaIndustryTemplateId;
  customMetrics: SaCustomMetricDef[];
  /** Standard scales hidden from scoring / UI. */
  hiddenDefaultScales: string[];
  systemPrompt: string;
  topics: string[];
  eventWebhook: SaEventWebhookConfig;
  digest: SaDigestConfig;
  alerts: SaAlertConfig;
  budget: SaBudgetConfig;
  /** Optional project model overrides (D-38); empty/null = module default. */
  sttModelId?: string | null;
  scoreModelId?: string | null;
};

export function defaultSaProjectConfig(): SaProjectConfigV1 {
  return {
    schemaVersion: 1,
    language: 'ru',
    sttRevisionId: 'eval-stt-v1',
    llmRevisionId: 'eval-llm-v1',
    rubricVersion: SA_RUBRIC_VERSION,
    maxBytes: 256 * 1024 * 1024,
    maxDurationMs: 30 * 60 * 1000,
    fallbackProviders: [],
    retentionRef: 'default',
    templateId: 'custom',
    customMetrics: [],
    hiddenDefaultScales: [],
    systemPrompt: '',
    topics: [...SA_TOPICS],
    eventWebhook: { url: null, headers: {}, events: [] },
    digest: {
      enabled: false,
      integrationUids: [],
      schedule: 'weekly',
      reportWindow: 'last_7_days',
      weeklyDay: 1,
      monthlyDay: 1,
      sendHour: 9,
    },
    alerts: {
      enabled: false,
      integrationUids: [],
      csatDrop: { enabled: true, dropPct: 20, windowDays: 7, minCalls: 5 },
      negativeSpike: { enabled: true, spikePp: 15, windowDays: 7, minCalls: 5 },
      budgetExceeded: { enabled: true },
    },
    budget: { softLimit: 0 },
    sttModelId: null,
    scoreModelId: null,
  };
}

export function isSaIndustryTemplateId(value: unknown): value is SaIndustryTemplateId {
  return typeof value === 'string'
    && (SA_INDUSTRY_TEMPLATES as readonly string[]).includes(value);
}

export type AnalyticsFilterSpec = {
  projectIds: string[];
  projectVersions?: string[];
  from: string;
  to: string;
  timezone: string;
  runSelector: 'latest_completed' | 'explicit';
  view: 'ai' | 'reviewed';
  direction?: string;
  statuses?: string[];
};

export type RouteAnalyticsOptions = {
  /** Selected analytics project; null/omit means no auto analysis (D-01, D-02). */
  projectId?: string | null;
  /** @deprecated D-01 — ignored; projectId alone decides auto analysis */
  mode?: 'inherit' | 'off' | 'on';
};

export function defaultAnalyticsFilter(projectId: string): AnalyticsFilterSpec {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return {
    projectIds: [projectId],
    from: from.toISOString(),
    to: to.toISOString(),
    timezone: 'Europe/Moscow',
    runSelector: 'latest_completed',
    view: 'ai',
  };
}

export function recordingBusinessKey(input: {
  tenantUid: number;
  principalId: string;
  projectId: string;
  externalCallId: string;
  sourcePart: string;
}): string {
  return [
    input.tenantUid, input.principalId, input.projectId,
    input.externalCallId, input.sourcePart,
  ].join('\u001f');
}
