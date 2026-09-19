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

const speechAnalyticsApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
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
  useReanalyzeSaRunMutation,
  useReviewSaRunMutation,
  useCorrectSaTranscriptMutation,
} = speechAnalyticsApi;
