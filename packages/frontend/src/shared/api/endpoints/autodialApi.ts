import { rtkApi } from "../rtkApi";
import type {
  IAutodialContactsPage,
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
  UpdateAutodialCampaignInput,
} from "@krasterisk/shared";

export type AutodialContactsPage = IAutodialContactsPage;

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
}

export interface AutodialImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; code: string; message: string }>;
  run: IAutodialImportRun;
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
}

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
  useGetAutodialBasesQuery,
  useGetAutodialBaseQuery,
  useCreateAutodialBaseMutation,
  useUpdateAutodialBaseMutation,
  useDeleteAutodialBaseMutation,
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
