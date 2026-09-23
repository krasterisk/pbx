import { defaultSaProjectConfig, type SaProjectConfigV1 } from '@krasterisk/shared';
import { rtkApi } from '@/shared/api/rtkApi';

export type { SaProjectConfigV1 };

export interface SaProject {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  draft_revision: number;
  active_version_id: string | null;
  draft_config?: SaProjectConfigV1;
}

function parseDraftConfig(raw: unknown): SaProjectConfigV1 {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...defaultSaProjectConfig(), ...(raw as SaProjectConfigV1) };
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return { ...defaultSaProjectConfig(), ...(JSON.parse(raw) as SaProjectConfigV1) };
    } catch {
      return defaultSaProjectConfig();
    }
  }
  return defaultSaProjectConfig();
}

function normalizeProject(row: SaProject & { draft_config?: unknown }): SaProject {
  return {
    ...row,
    draft_config: parseDraftConfig(row.draft_config),
  };
}

export interface SaRecording {
  id: string;
  project_id: string;
  external_call_id: string;
  occurred_at: string;
}

export interface SaRunCard {
  run: { id: string; state: string; recording_id: string; project_version_id: string };
  recording: SaRecording;
  result: {
    summary: string;
    metric_results: string;
    quality: string;
    status: string;
  } | null;
  transcript: { id: string; content_digest: string } | null;
}

export interface SaMetricDefinition {
  id: string;
  metric_key: string;
}

export interface SaMetricRubric {
  key: string;
  displayName: string;
  type: 'boolean' | 'number' | 'enum' | 'string';
  instructions: string;
  polarity: 'positive' | 'negative' | 'informational';
  weight: number;
  required: boolean;
  min?: number;
  max?: number;
  enumValues?: string[];
}

export interface SaJournalRow {
  id: string;
  occurredAt: string;
  sourceKind: string;
  latestAmount: string | null;
  currency: string | null;
  summary: string | null;
  operatorName?: string | null;
  callerPhone?: string | null;
  durationMs?: number | null;
  score?: number | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  topics?: string[];
  success?: boolean | null;
  lowStt?: boolean;
  projectName?: string | null;
}

export interface SaJournalList {
  items: SaJournalRow[];
  total: number;
  uploadProgress: { done: number; total: number };
}

export interface SaConversationDetail {
  id: string;
  sourceKind: string;
  audioUrl: string | null;
  summary: string | null;
  transcriptText: string | null;
  rebuildInProgress: boolean;
  runs: Array<{
    id: string;
    amount: string | null;
    currency: string | null;
    createdAt: string;
  }>;
}

const speechAnalyticsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    getSaJournal: builder.query<SaJournalList, void>({
      query: () => '/speech-analytics/journal',
      providesTags: [{ type: 'SpeechAnalytics', id: 'JOURNAL' }],
    }),
    getSaConversation: builder.query<SaConversationDetail, string>({
      query: (id) => `/speech-analytics/journal/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'SpeechAnalytics', id: `CONV-${id}` }],
    }),
    regenerateSaConversation: builder.mutation<{ runId: string }, string>({
      query: (id) => ({
        url: `/speech-analytics/journal/${id}/regenerate`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'SpeechAnalytics', id: 'JOURNAL' },
        { type: 'SpeechAnalytics', id: `CONV-${id}` },
      ],
    }),
    deleteSaConversation: builder.mutation<{ deleted: true }, string>({
      query: (id) => ({
        url: `/speech-analytics/journal/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'JOURNAL' }],
    }),
    getSaProjects: builder.query<SaProject[], void>({
      query: () => '/speech-analytics/projects',
      transformResponse: (rows: Array<SaProject & { draft_config?: unknown }>) =>
        (rows ?? []).map(normalizeProject),
      providesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    createSaProject: builder.mutation<SaProject, { name: string }>({
      query: (body) => ({ url: '/speech-analytics/projects', method: 'POST', body }),
      transformResponse: (row: SaProject & { draft_config?: unknown }) => normalizeProject(row),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    updateSaProjectDraft: builder.mutation<
      SaProject,
      { id: string; expectedRevision: number; config: SaProjectConfigV1 }
    >({
      query: ({ id, expectedRevision, config }) => ({
        url: `/speech-analytics/projects/${id}/draft`,
        method: 'PUT',
        body: config,
        headers: { 'If-Match': String(expectedRevision) },
      }),
      transformResponse: (row: SaProject & { draft_config?: unknown }) => normalizeProject(row),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    publishSaProject: builder.mutation<unknown, { id: string; operationKey: string }>({
      query: ({ id, operationKey }) => ({
        url: `/speech-analytics/projects/${id}/publish`, method: 'POST', body: { operationKey },
      }),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    testSaProjectWebhook: builder.mutation<{ ok: boolean } | unknown, { id: string }>({
      query: ({ id }) => ({
        url: `/speech-analytics/projects/${id}/webhook/test`,
        method: 'POST',
      }),
    }),
    setSaProjectIntake: builder.mutation<SaProject, { id: string; enabled: boolean }>({
      query: ({ id, enabled }) => ({
        url: `/speech-analytics/projects/${id}/intake`, method: 'PUT', body: { enabled },
      }),
      async onQueryStarted({ id, enabled }, { dispatch, queryFulfilled }) {
        const patch = dispatch(speechAnalyticsApi.util.updateQueryData('getSaProjects', undefined, (draft) => {
          const row = draft.find((item) => item.id === id);
          if (row) row.status = enabled ? 'active' : 'archived';
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    getSaRecordings: builder.query<SaRecording[], string>({
      query: (projectId) => `/speech-analytics/recordings?projectId=${projectId}`,
      providesTags: (_r, _e, projectId) => [{ type: 'SpeechAnalytics', id: `REC-${projectId}` }],
    }),
    getSaRun: builder.query<SaRunCard, string>({
      query: (id) => `/speech-analytics/analysis-runs/${id}`,
    }),
    getSaMetrics: builder.query<SaMetricDefinition[], string>({
      query: (id) => `/speech-analytics/projects/${id}/metrics`,
      providesTags: (_r, _e, id) => [{ type: 'SpeechAnalytics', id: `MET-${id}` }],
    }),
    getSaDashboard: builder.query<{
      scored: number;
      ranking: string;
      filterDigest: string;
      conversationCount?: number;
      costTotal?: string;
      lowSttCount?: number;
      successRate?: number;
      sentiment?: { positive: number; neutral: number; negative: number };
      scales?: Array<{ key: string; avg: number }>;
      customMetrics?: Array<{ id: string; label: string; avg: number }>;
      dynamics?: Array<{ label: string; avgScore: number; calls: number }>;
    }, { projectId: string }>({
      query: ({ projectId }) => ({
        url: '/speech-analytics/dashboard',
        method: 'POST',
        body: {
          projectIds: [projectId],
          from: new Date(Date.now() - 30 * 86400000).toISOString(),
          to: new Date().toISOString(),
          timezone: 'Europe/Moscow',
          runSelector: 'latest_completed',
          view: 'ai',
        },
      }),
    }),
    requestSaInsights: builder.mutation<
      {
        status: 'empty' | 'ok' | 'error';
        insights: Array<{
          type: string;
          title: string;
          observation: string;
          recommendation: string;
          evidence?: Record<string, unknown>;
        }>;
        amount: string | null;
        currency: string | null;
        fromCache?: boolean;
      },
      { projectId: string; filterDigest?: string; refresh?: boolean; conversationCount?: number }
    >({
      query: (body) => ({
        url: '/speech-analytics/insights',
        method: 'POST',
        body,
      }),
    }),
    getSaCapturePolicy: builder.query<{ pause_new: boolean; default_enabled: boolean; revision: number }, void>({
      query: () => '/speech-analytics/capture-policy',
      providesTags: [{ type: 'SpeechAnalytics', id: 'POLICY' }],
    }),
    setSaCapturePolicy: builder.mutation<unknown, { pauseNew: boolean }>({
      query: (body) => ({ url: '/speech-analytics/capture-policy', method: 'PUT', body }),
      /** Optimistic Switch (ARCHITECTURE): flip pause_new immediately; undo on failure. */
      async onQueryStarted({ pauseNew }, { dispatch, queryFulfilled }) {
        const patch = dispatch(speechAnalyticsApi.util.updateQueryData('getSaCapturePolicy', undefined, (draft) => {
          draft.pause_new = pauseNew;
        }));
        const modulePatch = dispatch(speechAnalyticsApi.util.updateQueryData('getSaModuleSettings', undefined, (draft) => {
          draft.pauseNew = pauseNew;
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
          modulePatch.undo();
        }
      },
      invalidatesTags: [
        { type: 'SpeechAnalytics', id: 'POLICY' },
        { type: 'SpeechAnalytics', id: 'MODULE_SETTINGS' },
      ],
    }),
    getSaModuleSettings: builder.query<{
      pauseNew: boolean;
      sttModelId: string | null;
      scoreModelId: string | null;
      insightsModelId: string | null;
      cabinetCanEditModels: boolean;
      modelAllowlist: Array<{ id: string; label: string }>;
      canEditModels: boolean;
    }, void>({
      query: () => '/speech-analytics/module-settings',
      providesTags: [{ type: 'SpeechAnalytics', id: 'MODULE_SETTINGS' }],
    }),
    setSaModuleModels: builder.mutation<
      unknown,
      {
        sttModelId?: string | null;
        scoreModelId?: string | null;
        insightsModelId?: string | null;
      }
    >({
      query: (body) => ({ url: '/speech-analytics/module-settings/models', method: 'PUT', body }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patch = dispatch(speechAnalyticsApi.util.updateQueryData('getSaModuleSettings', undefined, (draft) => {
          if (arg.sttModelId !== undefined) draft.sttModelId = arg.sttModelId;
          if (arg.scoreModelId !== undefined) draft.scoreModelId = arg.scoreModelId;
          if (arg.insightsModelId !== undefined) draft.insightsModelId = arg.insightsModelId;
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'MODULE_SETTINGS' }],
    }),
    publishSaMetric: builder.mutation<unknown, { id: string; operationKey: string; rubric: SaMetricRubric }>({
      query: ({ id, operationKey, rubric }) => ({
        url: `/speech-analytics/projects/${id}/metrics`, method: 'POST', body: { operationKey, rubric },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'SpeechAnalytics', id: `MET-${arg.id}` }],
    }),
    reanalyzeSaRun: builder.mutation<unknown, { id: string; projectVersionId: string; reason: string }>({
      query: ({ id, projectVersionId, reason }) => ({
        url: `/speech-analytics/analysis-runs/${id}/reanalyses`,
        method: 'POST',
        body: { projectVersionId, reason },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    }),
    reviewSaRun: builder.mutation<unknown, {
      id: string; metricRevisionId: string; value: string; status: 'accepted' | 'rejected' | 'cancelled';
      reason: string; commandKey: string; expectedRevision: number;
    }>({
      query: ({ id, ...body }) => ({
        url: `/speech-analytics/analysis-runs/${id}/reviews`, method: 'POST', body,
      }),
    }),
    correctSaTranscript: builder.mutation<unknown, { id: string; text: string; reason: string }>({
      query: ({ id, text, reason }) => ({
        url: `/speech-analytics/transcripts/${id}/corrections`, method: 'POST', body: { text, reason },
      }),
    }),
    /**
     * Cabinet batch upload (D-14…D-16) against 18-07 JWT allocate/content/complete + analysis-runs.
     * One file is a batch of 1. Per-file failure does not stop the rest. Never calls the wallet.
     */
    uploadSaCabinetBatch: builder.mutation<
      {
        kind: 'accepted';
        jobId: string;
        total: number;
        done: number;
        results: Array<{ filename: string; ok: boolean; error?: string; assetId?: string }>;
      },
      {
        projectId: string;
        operator?: { userId?: number; name?: string };
        clientPhone?: string;
        language?: string;
        files: Array<{ filename: string; bytesBase64: string }>;
      }
    >({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const results: Array<{ filename: string; ok: boolean; error?: string; assetId?: string }> = [];
        for (const file of arg.files) {
          try {
            const allocated = await baseQuery({
              url: '/speech-analytics/uploads',
              method: 'POST',
              body: { projectId: arg.projectId, expectedBytes: Math.ceil((file.bytesBase64.length * 3) / 4) },
            });
            if (allocated.error || !allocated.data || typeof allocated.data !== 'object') {
              results.push({ filename: file.filename, ok: false, error: 'allocate_failed' });
              continue;
            }
            const uploadId = String((allocated.data as { id?: string }).id ?? '');
            if (!uploadId) {
              results.push({ filename: file.filename, ok: false, error: 'allocate_failed' });
              continue;
            }
            const content = await baseQuery({
              url: `/speech-analytics/uploads/${uploadId}/content`,
              method: 'PUT',
              body: { bytesBase64: file.bytesBase64 },
            });
            if (content.error) {
              results.push({ filename: file.filename, ok: false, error: 'content_failed' });
              continue;
            }
            const complete = await baseQuery({
              url: `/speech-analytics/uploads/${uploadId}/complete`,
              method: 'POST',
              body: {},
            });
            if (complete.error || !complete.data || typeof complete.data !== 'object') {
              results.push({ filename: file.filename, ok: false, error: 'complete_failed' });
              continue;
            }
            const assetId = String((complete.data as { assetId?: string }).assetId ?? '');
            const run = await baseQuery({
              url: '/speech-analytics/analysis-runs',
              method: 'POST',
              body: {
                projectId: arg.projectId,
                assetId,
                metadata: {
                  source: 'upload',
                  filename: file.filename,
                  operator: arg.operator,
                  clientPhone: arg.clientPhone,
                  language: arg.language,
                },
              },
              headers: { 'Idempotency-Key': crypto.randomUUID() },
            });
            if (run.error) {
              results.push({ filename: file.filename, ok: false, error: 'analyze_failed', assetId });
              continue;
            }
            results.push({ filename: file.filename, ok: true, assetId });
          } catch {
            results.push({ filename: file.filename, ok: false, error: 'upload_failed' });
          }
        }
        return {
          data: {
            kind: 'accepted' as const,
            jobId: crypto.randomUUID(),
            total: arg.files.length,
            done: results.length,
            results,
          },
        };
      },
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'JOURNAL' }],
    }),
  }),
});

export const {
  useGetSaProjectsQuery,
  useCreateSaProjectMutation,
  useUpdateSaProjectDraftMutation,
  usePublishSaProjectMutation,
  useTestSaProjectWebhookMutation,
  useSetSaProjectIntakeMutation,
  useGetSaRecordingsQuery,
  useGetSaRunQuery,
  useGetSaMetricsQuery,
  usePublishSaMetricMutation,
  useGetSaDashboardQuery,
  useRequestSaInsightsMutation,
  useGetSaCapturePolicyQuery,
  useSetSaCapturePolicyMutation,
  useGetSaModuleSettingsQuery,
  useSetSaModuleModelsMutation,
  useReanalyzeSaRunMutation,
  useReviewSaRunMutation,
  useCorrectSaTranscriptMutation,
  useGetSaJournalQuery,
  useGetSaConversationQuery,
  useRegenerateSaConversationMutation,
  useDeleteSaConversationMutation,
  useUploadSaCabinetBatchMutation,
} = speechAnalyticsApi;
