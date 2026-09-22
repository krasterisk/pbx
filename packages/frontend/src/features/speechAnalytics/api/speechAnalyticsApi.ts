import { rtkApi } from '@/shared/api/rtkApi';

export interface SaProject {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  draft_revision: number;
  active_version_id: string | null;
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
      providesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    createSaProject: builder.mutation<SaProject, { name: string }>({
      query: (body) => ({ url: '/speech-analytics/projects', method: 'POST', body }),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
    }),
    publishSaProject: builder.mutation<unknown, { id: string; operationKey: string }>({
      query: ({ id, operationKey }) => ({
        url: `/speech-analytics/projects/${id}/publish`, method: 'POST', body: { operationKey },
      }),
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'PROJECTS' }],
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
      async onQueryStarted({ pauseNew }, { dispatch, queryFulfilled }) {
        const patch = dispatch(speechAnalyticsApi.util.updateQueryData('getSaCapturePolicy', undefined, (draft) => {
          draft.pause_new = pauseNew;
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: [{ type: 'SpeechAnalytics', id: 'POLICY' }],
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
  }),
});

export const {
  useGetSaProjectsQuery,
  useCreateSaProjectMutation,
  usePublishSaProjectMutation,
  useSetSaProjectIntakeMutation,
  useGetSaRecordingsQuery,
  useGetSaRunQuery,
  useGetSaMetricsQuery,
  usePublishSaMetricMutation,
  useGetSaDashboardQuery,
  useRequestSaInsightsMutation,
  useGetSaCapturePolicyQuery,
  useSetSaCapturePolicyMutation,
  useReanalyzeSaRunMutation,
  useReviewSaRunMutation,
  useCorrectSaTranscriptMutation,
  useGetSaJournalQuery,
  useGetSaConversationQuery,
  useRegenerateSaConversationMutation,
  useDeleteSaConversationMutation,
} = speechAnalyticsApi;
