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

export type SaMetricPolarity = 'positive' | 'negative' | 'neutral';

/** One metric the published project asks the model to score. */
export type SaProjectMetric = {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'enum' | 'string';
  description: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  unit?: string;
  polarity?: SaMetricPolarity;
  /** Builtin scale id. Scoring uses the aiPBX rubric while this stays set. */
  sourceScaleId?: SaDefaultScaleId | null;
};

export type SaCallTagDef = {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
};

export type SaCustomMetricDef = {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'enum' | 'string';
  description?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  unit?: string;
  polarity?: SaMetricPolarity;
};

export type SaEventWebhookItem = {
  event: SaWebhookEvent;
  url: string;
  headers: Record<string, string>;
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
  emails: string[];
  telegramChatIds: string[];
  schedule: 'daily' | 'weekly' | 'monthly';
  reportWindow: 'last_7_days' | 'last_30_days' | 'previous_calendar_month';
  weeklyDay?: number;
  monthlyDay?: number;
  sendHour?: number;
  lastSentAt?: string | null;
  lastManualSentAt?: string | null;
};

export type SaAlertConfig = {
  enabled: boolean;
  /** NotificationIntegrationsPage uids for this tenant (D-29). */
  integrationUids: number[];
  inheritRecipientsFromDigest: boolean;
  emails: string[];
  telegramChatIds: string[];
  csatDrop: { enabled: boolean; dropPct: number; windowDays: number; minCalls: number };
  negativeSpike: { enabled: boolean; spikePp: number; windowDays: number; minCalls: number };
  budgetExceeded: { enabled: boolean };
  lastTestSentAt?: string | null;
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
  description: string;
  /** Metrics the wizard produced. This is what scoring uses. */
  metrics: SaProjectMetric[];
  callTaxonomy: SaCallTagDef[];
  customMetrics: SaCustomMetricDef[];
  /** Standard scales hidden from scoring / UI. */
  hiddenDefaultScales: string[];
  systemPrompt: string;
  topics: string[];
  eventWebhook: SaEventWebhookConfig;
  /** One row per destination. eventWebhook stays for older readers. */
  eventWebhooks: SaEventWebhookItem[];
  digest: SaDigestConfig;
  alerts: SaAlertConfig;
  budget: SaBudgetConfig;
  /** Optional project model overrides (D-38); empty/null = module default. */
  sttModelId?: string | null;
  scoreModelId?: string | null;
};

const SCALE_COPY: Record<SaDefaultScaleId, { name: string; rubric: string }> = {
  greeting_quality: {
    name: 'Качество приветствия',
    rubric: 'Greeting/ID: 1)polite opener (Здравствуйте/Добрый день/Hello); 2)org/company name; 3)operator name or role; 4)offer to help',
  },
  script_compliance: {
    name: 'Следование скрипту',
    rubric: 'Script: {do not require booking or selling a service the company does not offer} 1)standard opening; 2)clarify customer need before acting; 3)required verification/disclosures when applicable; 4)workflow to a correct close',
  },
  politeness_empathy: {
    name: 'Вежливость и эмпатия',
    rubric: 'Politeness: {item 3 satisfied if no bad language} 1)please/thank-you forms used; 2)acknowledge concern when customer upset; 3)no rude/dismissive/interrupting language; 4)respectful professional tone',
  },
  active_listening: {
    name: 'Активное слушание',
    rubric: 'Listening: 1)clarifying Q or restate request; 2)confirm understanding before acting; 3)responses match customer input; 4)answers direct questions, no ignoring',
  },
  objection_handling: {
    name: 'Работа с возражениями',
    rubric: 'Objections: {no objection → score 100; an out-of-scope question is not an objection; offering alt after unavailable counts} 1)acknowledge objection; 2)explain/alternative/next step; 3)stay calm/professional; 4)move toward resolution',
  },
  product_knowledge: {
    name: 'Знание продукта',
    rubric: 'Knowledge: {accurate "we do not offer X; we offer Y or refer" = items 1 and 3, not evasion; naming options/slots also = item 3} 1)specific answers, not vague evasion; 2)consistent/plausible info; 3)explain options/steps/pricing when needed; 4)if unsure: admit + lookup/escalate',
  },
  problem_resolution: {
    name: 'Решение проблемы',
    rubric: 'Resolution: {clear scope refusal plus alternative, referral, or accepted close = items 2 and 4; unmet wish ≠ auto-fail} 1)identify problem/request; 2)concrete action taken; 3)confirm outcome/next step; 4)resolved in-call OR clear next step agreed',
  },
  speech_clarity_pace: {
    name: 'Темп речи',
    rubric: 'Speech: {judge transcript only, not accent/STT noise} 1)coherent understandable turns; 2)no excessive filler blocking meaning; 3)appropriately sized responses; 4)key numbers/dates/names clear in transcript',
  },
  closing_quality: {
    name: 'Качество завершения',
    rubric: 'Closing: 1)summarize done/next steps; 2)ask if anything else needed; 3)thank customer; 4)polite farewell',
  },
};

export function builtinScaleMetric(id: SaDefaultScaleId): SaProjectMetric {
  const copy = SCALE_COPY[id];
  return {
    id,
    name: copy.name,
    type: 'number',
    description: copy.rubric,
    min: 0,
    max: 100,
    polarity: 'positive',
    sourceScaleId: id,
  };
}

export function allBuiltinScaleMetrics(): SaProjectMetric[] {
  return SA_DEFAULT_SCALES.map((id) => builtinScaleMetric(id));
}

export function normalizeProjectMetric(metric: SaProjectMetric): SaProjectMetric {
  if ((metric.type as string) === 'scale') {
    return {
      ...metric,
      type: 'number',
      min: metric.min ?? 0,
      max: metric.max ?? 100,
      polarity: metric.polarity ?? 'positive',
    };
  }
  return metric;
}

/** Every saved metric is scored from its own description. Origin (template or custom) is not a separate rubric. */
export function rubricForMetric(metric: SaProjectMetric): string {
  return metric.description;
}

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
    description: '',
    metrics: allBuiltinScaleMetrics(),
    callTaxonomy: [],
    customMetrics: [],
    hiddenDefaultScales: [],
    systemPrompt: '',
    topics: [...SA_TOPICS],
    eventWebhook: { url: null, headers: {}, events: [] },
    eventWebhooks: [],
    digest: {
      enabled: false,
      integrationUids: [],
      emails: [],
      telegramChatIds: [],
      schedule: 'weekly',
      reportWindow: 'last_7_days',
      weeklyDay: 1,
      monthlyDay: 1,
      sendHour: 9,
    },
    alerts: {
      enabled: false,
      integrationUids: [],
      inheritRecipientsFromDigest: true,
      emails: [],
      telegramChatIds: [],
      csatDrop: { enabled: true, dropPct: 20, windowDays: 7, minCalls: 5 },
      negativeSpike: { enabled: true, spikePp: 15, windowDays: 7, minCalls: 5 },
      budgetExceeded: { enabled: true },
    },
    budget: { softLimit: 0 },
    sttModelId: null,
    scoreModelId: null,
  };
}

export function saEventWebhookTargets(
  config: Pick<SaProjectConfigV1, 'eventWebhook' | 'eventWebhooks'>,
  event: SaWebhookEvent,
): Array<{ url: string; headers: Record<string, string> }> {
  const listed = (config.eventWebhooks ?? []).filter((row) => row.event === event && row.url.trim());
  if (listed.length) {
    return listed.map((row) => ({ url: row.url.trim(), headers: row.headers ?? {} }));
  }
  if (config.eventWebhook?.url && (config.eventWebhook.events ?? []).includes(event)) {
    return [{ url: config.eventWebhook.url, headers: config.eventWebhook.headers ?? {} }];
  }
  return [];
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
