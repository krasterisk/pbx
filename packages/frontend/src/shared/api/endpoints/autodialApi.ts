import { rtkApi } from "../rtkApi";
import type {
  IAutodialContactsPage,
  IAutodialCampaignContactsPage,
  AutodialSchemaMigrationRequest,
  IAutodialSchemaPreview,
  IAutodialFieldUsage,
  CreateAutodialBaseInput,
  UpdateAutodialBaseInput,
  CreateAutodialContactInput,
  UpdateAutodialContactInput,
  UpsertAutodialImportProfileInput,
  AutodialDedupPolicy,
  AutodialDisposition,
  AutodialImportSource,
  CreateAutodialCampaignInput,
  IAutodialBase,
  IAutodialCampaign,
  IAutodialCampaignLiveStats,
  IAutodialColumnMap,
  IAutodialContact,
  IAutodialDailyStats,
  IAutodialDncEntry,
  IAutodialImportProfile,
  IAutodialImportRun,
  IAutodialSchedule,
  IAutodialDiagnosis,
  IAutodialPreflight,
  IAutodialMonitorHealth,
  UpdateAutodialCampaignInput,
} from "@krasterisk/shared";

export type AutodialContactsPage = IAutodialContactsPage;
export interface AutodialIntegrationKey { uid: string; label: string; scopes: string[]; expires_at: string; revoked_at: string | null; created_at: string }
export interface AutodialScenarioPreview {
  campaign_uid: number; revision: number; base_uid: number; contact_uid: number | null;
  variables: Array<{ name: string; label: string; type: string; value: string | null }>;
  steps: Array<{ id: string; type: string; text?: string; missing?: string[]; engine_uid?: number | null }>;
  dialplan: string;
}

export interface AutodialImportPreview {
  base_revision: number;
  headers: string[];
  sample_rows: string[][];
  delimiter: string;
  total_rows: number;
}

export interface AutodialUploadArgs {
  baseUid: number;
  filename?: string;
  source?: AutodialImportSource;
  content_base64: string;
  profile_uid?: number;
  column_map?: IAutodialColumnMap[];
  delimiter?: string;
  has_header?: boolean;
  dedup_policy?: AutodialDedupPolicy;
  replace?: boolean;
  expected_revision?: number;
  invalid_optional_policy?: 'reject' | 'omit';
}

export interface AutodialImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; code: string; message: string; values?: string[] }>;
  rejected_rows?: Array<{ row: number; code: string; message: string; values?: string[] }>;
  headers?: string[];
  warnings?: Array<{ row: number; field: string; value: string; code: string }>;
  run: IAutodialImportRun;
}
export interface AutodialImportValidation {
  base_revision: number; total_rows: number; valid: number; skipped: number; ready: boolean;
  headers: string[]; errors: AutodialImportResult['errors']; warnings: NonNullable<AutodialImportResult['warnings']>;
  rejected_rows: NonNullable<AutodialImportResult['rejected_rows']>;
}

export type AutodialCampaignWithSchedules = IAutodialCampaign & {
  schedules: IAutodialSchedule[];
};

export interface AutodialReportQuery {
  from: string;
  to: string;
  campaigns?: number[];
}

export interface AutodialSummaryRow {
  campaign_uid: number;
  campaign_name: string;
  dials: number;
  answered: number;
  success: number;
  short: number;
  no_answer: number;
  busy: number;
  amd: number;
  failed: number;
  talk_sec_sum: number;
  billsec_sum: number;
  kpi: {
    contact_rate: number;
    rpc: number;
    asr: number;
    aht: number;
    acd: number;
    abandon_rate: number;
    list_penetration: number;
    dials_per_contact: number;
    calls_per_hour: number;
  };
}

export interface AutodialDetailRow {
  uniqueid?: string | null;
  attempt_uid: number;
  campaign_uid: number;
  task_uid: number;
  attempt_no: number;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration: number;
  billsec: number;
  disposition: AutodialDisposition;
  hangup_cause: string | null;
  trunk_id: string | null;
  caller_id: string | null;
  queue_name: string | null;
  agent_interface: string | null;
  amd_result: string | null;
  scenario_result: { dtmf?: string | null; [key: string]: unknown } | null;
}
export type AutodialAnalyticsDimension = 'attempt' | 'hour' | 'heatmap' | 'segment' | 'hangup' | 'operator' | 'business_outcome' | 'disposition';
export interface AutodialAnalyticsArgs { from: string; to: string; campaign_uids?: number[]; dimension: AutodialAnalyticsDimension; field_uid?: number; value?: string }
export interface AutodialBreakdown { dimension: AutodialAnalyticsDimension; timezone: string; from: string; to: string; truncated: boolean;
  rows: Array<{ value: string; dials: number; answered: number; success: number; talk_sec: number; contact_rate: number }> }

function reportParams(query: AutodialReportQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.campaigns?.length)
    params.set("campaigns", query.campaigns.join(","));
  return params.toString();
}

const autodialApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (builder) => ({
    // ── bases ─────────────────────────────────────────────────────
    getAutodialBases: builder.query<IAutodialBase[], void>({
      query: () => "/autodial/bases",
      providesTags: (result) =>
        result
          ? [
              ...result.map((b) => ({
                type: "AutodialBases" as const,
                id: b.uid,
              })),
              { type: "AutodialBases", id: "LIST" },
            ]
          : [{ type: "AutodialBases", id: "LIST" }],
    }),

    getAutodialBase: builder.query<IAutodialBase, number>({
      query: (uid) => `/autodial/bases/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: "AutodialBases", id: uid }],
    }),

    createAutodialBase: builder.mutation<
      IAutodialBase,
      CreateAutodialBaseInput
    >({
      query: (body) => ({ url: "/autodial/bases", method: "POST", body }),
      invalidatesTags: [{ type: "AutodialBases", id: "LIST" }],
    }),

    updateAutodialBase: builder.mutation<
      IAutodialBase,
      { uid: number; data: UpdateAutodialBaseInput }
    >({
      query: ({ uid, data }) => ({
        url: `/autodial/bases/${uid}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: "AutodialBases", id: uid },
        { type: "AutodialBases", id: "LIST" },
        { type: "AutodialContacts", id: uid },
      ],
    }),

    deleteAutodialBase: builder.mutation<{ deleted: boolean }, number>({
      query: (uid) => ({ url: `/autodial/bases/${uid}`, method: "DELETE" }),
      invalidatesTags: [{ type: "AutodialBases", id: "LIST" }],
    }),

    bulkDeleteAutodialBases: builder.mutation<
      { deleted: number[]; failed: Array<{ uid: number; code: string }> },
      number[]
    >({
      query: (uids) => ({
        url: "/autodial/bases/bulk-delete",
        method: "POST",
        body: { uids },
      }),
      invalidatesTags: [{ type: "AutodialBases", id: "LIST" }],
    }),

    // ── contacts ──────────────────────────────────────────────────
    getAutodialContact: builder.query<
      IAutodialContact,
      { baseUid: number; contactUid: number }
    >({
      query: ({ baseUid, contactUid }) =>
        `/autodial/bases/${baseUid}/contacts/${contactUid}`,
      providesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
      ],
    }),
    getAutodialContacts: builder.query<
      AutodialContactsPage,
      { baseUid: number; page?: number; pageSize?: number; q?: string }
    >({
      query: ({ baseUid, page, pageSize, q }) => {
        const params = new URLSearchParams();
        if (page) params.set("page", String(page));
        if (pageSize) params.set("page_size", String(pageSize));
        if (q) params.set("q", q);
        const suffix = params.toString();
        return `/autodial/bases/${baseUid}/contacts${suffix ? `?${suffix}` : ""}`;
      },
      providesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
      ],
    }),

    createAutodialContact: builder.mutation<
      IAutodialContact,
      { baseUid: number; data: CreateAutodialContactInput }
    >({
      query: ({ baseUid, data }) => ({
        url: `/autodial/bases/${baseUid}/contacts`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
        { type: "AutodialBases", id: baseUid },
      ],
    }),

    updateAutodialContact: builder.mutation<
      IAutodialContact,
      { baseUid: number; contactUid: number; data: UpdateAutodialContactInput }
    >({
      query: ({ baseUid, contactUid, data }) => ({
        url: `/autodial/bases/${baseUid}/contacts/${contactUid}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
      ],
    }),

    deleteAutodialContact: builder.mutation<
      { deleted: boolean },
      { baseUid: number; contactUid: number }
    >({
      query: ({ baseUid, contactUid }) => ({
        url: `/autodial/bases/${baseUid}/contacts/${contactUid}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
        { type: "AutodialBases", id: baseUid },
      ],
    }),

    // ── import ────────────────────────────────────────────────────
    validateAutodialImport: builder.mutation<AutodialImportValidation, AutodialUploadArgs>({
      query: ({ baseUid, ...body }) => ({ url: `/autodial/bases/${baseUid}/import-validation`, method: 'POST', body }),
    }),
    downloadAutodialRejected: builder.mutation<Blob, AutodialUploadArgs>({
      query: ({ baseUid, ...body }) => ({ url: `/autodial/bases/${baseUid}/import-rejected`, method: 'POST', body, responseHandler: (response) => response.blob() }),
    }),
    getAutodialImportProfiles: builder.query<IAutodialImportProfile[], number>({
      query: (baseUid) => `/autodial/bases/${baseUid}/import-profiles`,
      providesTags: (_r, _e, baseUid) => [
        { type: "AutodialImportProfiles", id: baseUid },
      ],
    }),

    upsertAutodialImportProfile: builder.mutation<
      IAutodialImportProfile,
      { baseUid: number; data: UpsertAutodialImportProfileInput }
    >({
      query: ({ baseUid, data }) => ({
        url: `/autodial/bases/${baseUid}/import-profiles`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialImportProfiles", id: baseUid },
      ],
    }),

    deleteAutodialImportProfile: builder.mutation<
      { deleted: boolean },
      { baseUid: number; profileUid: number }
    >({
      query: ({ baseUid, profileUid }) => ({
        url: `/autodial/bases/${baseUid}/import-profiles/${profileUid}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialImportProfiles", id: baseUid },
      ],
    }),

    /** Dry run — headers and sample rows for the column mapping step. */
    previewAutodialImport: builder.mutation<
      AutodialImportPreview,
      AutodialUploadArgs
    >({
      query: ({ baseUid, ...body }) => ({
        url: `/autodial/bases/${baseUid}/import-preview`,
        method: "POST",
        body,
      }),
    }),

    importAutodialFile: builder.mutation<
      AutodialImportResult,
      AutodialUploadArgs
    >({
      query: ({ baseUid, ...body }) => ({
        url: `/autodial/bases/${baseUid}/import`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { baseUid }) => [
        { type: "AutodialContacts", id: baseUid },
        { type: "AutodialBases", id: baseUid },
        { type: "AutodialBases", id: "LIST" },
      ],
    }),

    // ── campaigns ─────────────────────────────────────────────────
    getAutodialCampaigns: builder.query<AutodialCampaignWithSchedules[], void>({
      query: () => "/autodial/campaigns",
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({
                type: "AutodialCampaigns" as const,
                id: c.uid,
              })),
              { type: "AutodialCampaigns", id: "LIST" },
            ]
          : [{ type: "AutodialCampaigns", id: "LIST" }],
    }),

    getAutodialCampaign: builder.query<AutodialCampaignWithSchedules, number>({
      query: (uid) => `/autodial/campaigns/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: "AutodialCampaigns", id: uid }],
    }),

    createAutodialCampaign: builder.mutation<
      AutodialCampaignWithSchedules,
      CreateAutodialCampaignInput
    >({
      query: (body) => ({ url: "/autodial/campaigns", method: "POST", body }),
      invalidatesTags: [{ type: "AutodialCampaigns", id: "LIST" }],
    }),

    updateAutodialCampaign: builder.mutation<
      AutodialCampaignWithSchedules,
      { uid: number; data: UpdateAutodialCampaignInput }
    >({
      query: ({ uid, data }) => ({
        url: `/autodial/campaigns/${uid}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: "AutodialCampaigns", id: uid },
        { type: "AutodialCampaigns", id: "LIST" },
      ],
    }),

    deleteAutodialCampaign: builder.mutation<{ deleted: boolean }, number>({
      query: (uid) => ({ url: `/autodial/campaigns/${uid}`, method: "DELETE" }),
      invalidatesTags: [{ type: "AutodialCampaigns", id: "LIST" }],
    }),

    startAutodialCampaign: builder.mutation<
      { campaign: AutodialCampaignWithSchedules; tasks_created: number },
      { uid: number; include_dispositions?: AutodialDisposition[] }
    >({
      query: ({ uid, ...body }) => ({
        url: `/autodial/campaigns/${uid}/start`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: "AutodialCampaigns", id: uid },
        { type: "AutodialCampaigns", id: "LIST" },
      ],
    }),

    setAutodialCampaignState: builder.mutation<
      AutodialCampaignWithSchedules,
      { uid: number; action: "pause" | "resume" | "stop" }
    >({
      query: ({ uid, action }) => ({
        url: `/autodial/campaigns/${uid}/${action}`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { uid }) => [
        { type: "AutodialCampaigns", id: uid },
        { type: "AutodialCampaigns", id: "LIST" },
      ],
    }),

    // ── DNC ───────────────────────────────────────────────────────
    getAutodialDnc: builder.query<IAutodialDncEntry[], void>({
      query: () => "/autodial/dnc",
      providesTags: [{ type: "AutodialDnc", id: "LIST" }],
    }),

    createAutodialDnc: builder.mutation<
      IAutodialDncEntry,
      Record<string, unknown>
    >({
      query: (body) => ({ url: "/autodial/dnc", method: "POST", body }),
      invalidatesTags: [{ type: "AutodialDnc", id: "LIST" }],
    }),

    deleteAutodialDnc: builder.mutation<{ deleted: boolean }, number>({
      query: (uid) => ({ url: `/autodial/dnc/${uid}`, method: "DELETE" }),
      invalidatesTags: [{ type: "AutodialDnc", id: "LIST" }],
    }),

    // ── monitor / reports ─────────────────────────────────────────

    getAutodialFieldUsage: builder.query<IAutodialFieldUsage, number>({
      query: (uid) => `/autodial/bases/${uid}/field-usage`, providesTags: ['AutodialBases', 'AutodialCampaigns', 'AutodialImportProfiles'],
    }),
    previewAutodialSchema: builder.mutation<IAutodialSchemaPreview, { uid: number; data: AutodialSchemaMigrationRequest }>({
      query: ({ uid, data }) => ({ url: `/autodial/bases/${uid}/schema-preview`, method: 'POST', body: data }),
    }),
    applyAutodialSchema: builder.mutation<IAutodialBase, { uid: number; data: AutodialSchemaMigrationRequest }>({
      query: ({ uid, data }) => ({ url: `/autodial/bases/${uid}/schema-apply`, method: 'POST', body: data }),
      invalidatesTags: ['AutodialBases', 'AutodialContacts', 'AutodialCampaigns', 'AutodialImportProfiles'],
    }),

    getAutodialScenarioPreview: builder.query<AutodialScenarioPreview, { uid: number; contactUid?: number }>({
      query: ({ uid, contactUid }) => `/autodial/campaigns/${uid}/scenario-preview${contactUid ? `?contact_uid=${contactUid}` : ''}`,
      providesTags: ['AutodialCampaigns', 'AutodialBases', 'AutodialContacts'],
    }),
    previewAutodialAudio: builder.mutation<Blob, { uid: number; contactUid: number; stepId: string }>({
      query: ({ uid, contactUid, stepId }) => ({ url: `/autodial/campaigns/${uid}/scenario-preview/${contactUid}/${encodeURIComponent(stepId)}/audio`, responseHandler: (response) => response.blob() }),
    }),
    requestAutodialTestCall: builder.mutation<{ uid: string; status: string; endpoint: string; skipped_steps: string[] }, { uid: number; contact_uid: number; expected_revision: number; idempotency_key: string }>({
      query: ({ uid, ...body }) => ({ url: `/autodial/campaigns/${uid}/test-call`, method: 'POST', body }),
    }),

    checkAutodialDraft: builder.mutation<IAutodialPreflight, CreateAutodialCampaignInput>({
      query: (body) => ({ url: '/autodial/preflight-draft', method: 'POST', body }),
    }),

    changeAutodialContactTask: builder.mutation<{ updated: number }, { uid: number; contactUid: number; action: 'exclude' | 'reschedule'; next_attempt_at?: string; phone_uid?: number }>({
      query: ({ uid, contactUid, ...body }) => ({ url: `/autodial/campaigns/${uid}/contacts/${contactUid}/task-action`, method: 'POST', body }),
      invalidatesTags: ['AutodialContacts', 'AutodialCampaigns'],
    }),

    getAutodialJournal: builder.query<Array<{ uid: number; event_type: string; tour_no: number; revision: number; payload: Record<string, unknown> | null; created_at: string }>, { uid: number; before?: number }>({
      query: ({ uid, before }) => `/autodial/campaigns/${uid}/journal${before ? `?before=${before}` : ''}`,
      providesTags: (_r, _e, { uid }) => [{ type: 'AutodialCampaigns', id: uid }],
    }),
    getAutodialAiPrivacy: builder.query<{ allow_personal_data: boolean }, void>({
      query: () => '/autodial/ai-privacy', providesTags: [{ type: 'AutodialBases', id: 'AI_PRIVACY' }],
    }),
    getAutodialIntegrationKeys: builder.query<AutodialIntegrationKey[], void>({
      query: () => '/autodial/integration-keys', providesTags: ['AutodialBases'],
    }),
    createAutodialIntegrationKey: builder.mutation<{ uid: string; token: string }, { label: string; scopes: string[]; expires_at: string }>({
      query: (body) => ({ url: '/autodial/integration-keys', method: 'POST', body }), invalidatesTags: ['AutodialBases'],
    }),
    revokeAutodialIntegrationKey: builder.mutation<{ revoked: boolean }, string>({
      query: (uid) => ({ url: `/autodial/integration-keys/${uid}`, method: 'DELETE' }), invalidatesTags: ['AutodialBases'],
    }),
    getAutodialCapabilities: builder.query<{ tts_engines: Array<{ uid: number; name: string; is_global: boolean }> }, void>({
      query: () => '/autodial/capabilities', providesTags: ['TtsEngines'],
    }),
    getAutodialMonitorHealth: builder.query<IAutodialMonitorHealth, void>({
      query: () => '/autodial/monitor-health', providesTags: ['AutodialCampaigns'],
    }),
    updateAutodialAiPrivacy: builder.mutation<{ allow_personal_data: boolean }, { allow_personal_data: boolean }>({
      query: (body) => ({ url: '/autodial/ai-privacy', method: 'PUT', body }),
      invalidatesTags: [{ type: 'AutodialBases', id: 'AI_PRIVACY' }],
    }),

    getAutodialCampaignContacts: builder.query<IAutodialCampaignContactsPage,
      { uid: number; page?: number; pageSize?: number; q?: string; disposition?: string }>({
      query: ({ uid, page = 1, pageSize = 25, q = '', disposition = '' }) =>
        `/autodial/campaigns/${uid}/contacts?${new URLSearchParams({ page: String(page), page_size: String(pageSize), q, disposition })}`,
      providesTags: (_r, _e, { uid }) => [ 'AutodialContacts', 'AutodialDnc', { type: 'AutodialCampaigns', id: uid } ],
    }),

    getAutodialDiagnosis: builder.query<IAutodialDiagnosis, number>({
      query: (uid) => `/autodial/campaigns/${uid}/diagnosis`,
      providesTags: (_result, _error, uid) => [{ type: 'AutodialCampaigns', id: uid }],
    }),

    getAutodialPreflight: builder.query<IAutodialPreflight, number>({
      query: (uid) => `/autodial/campaigns/${uid}/preflight`,
      providesTags: (_result, _error, uid) => [{ type: 'AutodialCampaigns', id: uid }, 'AutodialBases', 'AutodialDnc'],
    }),
    getAutodialMonitor: builder.query<IAutodialCampaignLiveStats[], void>({
      query: () => "/autodial/monitor",
      providesTags: [{ type: "AutodialReports", id: "MONITOR" }],
    }),

    getAutodialSummary: builder.query<
      AutodialSummaryRow[],
      AutodialReportQuery
    >({
      query: (query) => `/autodial/reports/summary?${reportParams(query)}`,
      providesTags: [{ type: "AutodialReports", id: "SUMMARY" }],
    }),

    getAutodialDaily: builder.query<IAutodialDailyStats[], AutodialReportQuery>(
      {
        query: (query) => `/autodial/reports/daily?${reportParams(query)}`,
        providesTags: [{ type: "AutodialReports", id: "DAILY" }],
      },
    ),

    getAutodialDetail: builder.query<AutodialDetailRow[], AutodialReportQuery>({
      query: (query) => `/autodial/reports/detail?${reportParams(query)}`,
      providesTags: [{ type: "AutodialReports", id: "DETAIL" }],
    }),
    getAutodialBreakdown: builder.query<AutodialBreakdown, AutodialAnalyticsArgs>({
      query: (body) => ({ url: '/autodial/reports/breakdown', method: 'POST', body }), providesTags: ['AutodialReports'],
    }),
    previewAutodialSelectionBase: builder.mutation<{ contact_count: number; preview_hash: string }, AutodialAnalyticsArgs>({
      query: (body) => ({ url: '/autodial/reports/selection/preview', method: 'POST', body }),
    }),
    createAutodialSelectionBase: builder.mutation<IAutodialBase, { filter: AutodialAnalyticsArgs; name: string; preview_hash: string }>({
      query: (body) => ({ url: '/autodial/reports/selection/base', method: 'POST', body }), invalidatesTags: ['AutodialBases'],
    }),
    getAutodialSelection: builder.query<{ rows: AutodialDetailRow[]; timezone: string; truncated: boolean; limit: number }, AutodialAnalyticsArgs>({
      query: (body) => ({ url: '/autodial/reports/selection', method: 'POST', body }), providesTags: ['AutodialReports'],
    }),
    getAutodialRecording: builder.mutation<Blob, string>({
      query: (uniqueid) => ({ url: `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`, responseHandler: (response) => response.blob() }),
    }),
  }),
});

/** Export URL for the browser to download directly — no RTK cache involved. */
export function autodialExportUrl(
  query: AutodialReportQuery,
  kind: "summary" | "detail",
  format: "csv" | "xlsx",
): string {
  const base = import.meta.env.VITE_API_URL || "/api";
  const token = localStorage.getItem("accessToken") ?? "";
  return `${base}/autodial/reports/export?${reportParams(query)}&kind=${kind}&format=${format}&token=${encodeURIComponent(token)}`;
}

export const {
  useGetAutodialBreakdownQuery,
  usePreviewAutodialSelectionBaseMutation,
  useCreateAutodialSelectionBaseMutation,
  useGetAutodialSelectionQuery,
  useGetAutodialRecordingMutation,
  useGetAutodialAiPrivacyQuery,
  useGetAutodialIntegrationKeysQuery,
  useCreateAutodialIntegrationKeyMutation,
  useRevokeAutodialIntegrationKeyMutation,
  useGetAutodialCapabilitiesQuery,
  useGetAutodialMonitorHealthQuery,
  useUpdateAutodialAiPrivacyMutation,
  useValidateAutodialImportMutation,
  useDownloadAutodialRejectedMutation,
  useGetAutodialFieldUsageQuery,
  usePreviewAutodialSchemaMutation,
  useApplyAutodialSchemaMutation,
  useGetAutodialScenarioPreviewQuery,
  usePreviewAutodialAudioMutation,
  useRequestAutodialTestCallMutation,
  useCheckAutodialDraftMutation,
  useChangeAutodialContactTaskMutation,
  useGetAutodialJournalQuery,
  useGetAutodialCampaignContactsQuery,
  useGetAutodialDiagnosisQuery,
  useGetAutodialPreflightQuery,
  useGetAutodialBasesQuery,
  useGetAutodialBaseQuery,
  useCreateAutodialBaseMutation,
  useUpdateAutodialBaseMutation,
  useDeleteAutodialBaseMutation,
  useBulkDeleteAutodialBasesMutation,
  useGetAutodialContactsQuery,
  useGetAutodialContactQuery,
  useCreateAutodialContactMutation,
  useUpdateAutodialContactMutation,
  useDeleteAutodialContactMutation,
  useGetAutodialImportProfilesQuery,
  useUpsertAutodialImportProfileMutation,
  useDeleteAutodialImportProfileMutation,
  usePreviewAutodialImportMutation,
  useImportAutodialFileMutation,
  useGetAutodialCampaignsQuery,
  useGetAutodialCampaignQuery,
  useCreateAutodialCampaignMutation,
  useUpdateAutodialCampaignMutation,
  useDeleteAutodialCampaignMutation,
  useStartAutodialCampaignMutation,
  useSetAutodialCampaignStateMutation,
  useGetAutodialDncQuery,
  useCreateAutodialDncMutation,
  useDeleteAutodialDncMutation,
  useGetAutodialMonitorQuery,
  useGetAutodialSummaryQuery,
  useGetAutodialDailyQuery,
  useGetAutodialDetailQuery,
} = autodialApi;
