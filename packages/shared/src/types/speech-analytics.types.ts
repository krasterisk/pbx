export const SA_RUBRIC_VERSION = 'sa-metrics-v1' as const;
export const SA_METRICS = ['greeting_present', 'next_step_agreed', 'topic'] as const;
export type SaMetricId = typeof SA_METRICS[number];

export const SA_METRIC_STATUSES = ['scored', 'unknown', 'not_applicable', 'unscorable'] as const;
export type SaMetricStatus = typeof SA_METRIC_STATUSES[number];

export const SA_TOPICS = ['sales', 'support', 'other'] as const;
export type SaTopic = typeof SA_TOPICS[number];

export const SA_RUN_STATES = [
  'queued', 'running', 'retry_wait', 'awaiting_reconciliation',
  'partial', 'completed', 'failed', 'cancelled',
] as const;
export type SaRunState = typeof SA_RUN_STATES[number];

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
};

export type SaMetricResult = {
  id: SaMetricId;
  status: SaMetricStatus;
  value: boolean | SaTopic | null;
  evidence: ReadonlyArray<{ segmentId: string; startMs: number; endMs: number }>;
  rationale: string;
  rubricRevision: typeof SA_RUBRIC_VERSION;
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
  };
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
  mode: 'inherit' | 'off' | 'on';
  projectId?: string;
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
