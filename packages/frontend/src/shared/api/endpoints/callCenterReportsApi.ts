import { rtkApi } from '../rtkApi';
import type { AgentTimelineSegment } from '@/features/callcenter/model/types/callCenterSchema';

/** Closed whitelist — mirrors backend callcenter-reports.types.ts */
export const CC_REPORT_IDS = [
  'queue-summary',
  'call-detail',
  'operator-stats',
  'pause-report',
  'hourly-heatmap',
  'agent-timeline',
  'missed-callback',
] as const;

export type CcReportId = (typeof CC_REPORT_IDS)[number];

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportResult<T = Record<string, unknown>> {
  reportId: CcReportId;
  columns: ReportColumn[];
  rows: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  source?: 'raw' | 'rollup';
}

export interface QueueSummaryRow {
  queueName: string;
  totalCalls: number;
  answeredCalls: number;
  abandonedCalls: number;
  slaPct: number;
  asrPct: number;
  asaSec: number;
  ahtSec: number;
  abandonPct: number;
  maxWaitSec: number;
}

export interface CallDetailRow {
  callUniqueid: string;
  queueName: string;
  agentInterface: string;
  callerIdNum: string;
  callerIdName: string;
  enterTime: string | null;
  answerTime: string | null;
  endTime: string | null;
  waitTime: number;
  talkTime: number;
  holdTime: number;
  wrapupTime: number;
  disposition: string;
}

export interface OperatorStatsRow {
  agentInterface: string;
  agentUserUid: number | null;
  callsHandled: number;
  totalTalkSec: number;
  totalHoldSec: number;
  totalWrapupSec: number;
  avgHandleSec: number;
  ahtSec: number;
}

export interface PauseReportRow {
  agentInterface: string;
  userId: number;
  pauseReason: string;
  pauseCount: number;
  totalPauseSec: number;
  avgPauseSec: number;
}

export interface HourlyHeatmapRow {
  dayOfWeek: number;
  hour: number;
  callCount: number;
}

export interface AgentTimelineRow {
  agentInterface: string;
  segments: AgentTimelineSegment[];
}

export interface MissedCallbackRow {
  uid: number;
  callUniqueid: string;
  queueName: string;
  callerIdNum: string;
  callerIdName: string;
  holdTime: number;
  position: number;
  calledBack: boolean;
  calledBackBy: number | null;
  calledBackAt: string | null;
  note: string;
  createdAt: string;
}

export interface ReportQueryParams {
  dateFrom: string;
  dateTo: string;
  queueName?: string;
  agentInterface?: string;
  page?: number;
  pageSize?: number;
}

export interface AgentTimelineQueryParams {
  agentInterface: string;
  /** Single day — mapped to dateFrom/dateTo */
  date: string;
}

export interface ExportReportParams extends ReportQueryParams {
  reportId: CcReportId;
  format: 'csv' | 'xlsx';
}

/** Scheduled report delivery config (D-35) — mirrors backend CcReportSchedule */
export type ReportSchedulePeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-30-days'
  | 'previous-month';

export type ReportScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportSchedule {
  uid: number;
  name: string;
  report_id: CcReportId;
  format: 'csv' | 'xlsx';
  period_preset: ReportSchedulePeriodPreset;
  filters?: { queueName?: string; agentInterface?: string } | null;
  frequency: ReportScheduleFrequency;
  hour: number;
  minute: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
  integration_uid: number;
  target?: string | null;
  subject_template?: string | null;
  message_template?: string | null;
  enabled: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  next_run_at?: string | null;
}

export type ReportSchedulePayload = Omit<
  ReportSchedule,
  'uid' | 'last_run_at' | 'last_status' | 'last_error' | 'next_run_at'
>;

const callCenterReportsApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getReport: build.query<ReportResult, { reportId: CcReportId } & ReportQueryParams>({
      query: ({ reportId, ...params }) => ({
        url: `/callcenter/reports/${reportId}`,
        params,
      }),
    }),
    getAgentTimeline: build.query<ReportResult<AgentTimelineRow>, AgentTimelineQueryParams>({
      query: ({ agentInterface, date }) => ({
        url: '/callcenter/reports/agent-timeline',
        params: {
          agentInterface,
          dateFrom: date,
          dateTo: date,
        },
      }),
    }),
    exportReport: build.query<Blob, ExportReportParams>({
      query: ({ reportId, format, ...params }) => ({
        url: `/callcenter/reports/${reportId}/export`,
        params: { ...params, format },
        responseHandler: (response) => response.blob(),
      }),
    }),
    getReportSchedules: build.query<ReportSchedule[], void>({
      query: () => '/callcenter/report-schedules',
      providesTags: ['ReportSchedules'],
    }),
    createReportSchedule: build.mutation<ReportSchedule, ReportSchedulePayload>({
      query: (body) => ({
        url: '/callcenter/report-schedules',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ReportSchedules'],
    }),
    updateReportSchedule: build.mutation<
      ReportSchedule,
      { uid: number } & Partial<ReportSchedulePayload>
    >({
      query: ({ uid, ...body }) => ({
        url: `/callcenter/report-schedules/${uid}`,
        method: 'PUT',
        body,
      }),
      /** Optimistic: enabled Switch (and other inline edits) flip immediately; undo on failure. */
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const { uid, ...patch } = arg;
        const patchResult = dispatch(
          callCenterReportsApi.util.updateQueryData('getReportSchedules', undefined, (draft) => {
            const row = draft.find((r) => r.uid === uid);
            if (row) Object.assign(row, patch);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            callCenterReportsApi.util.updateQueryData('getReportSchedules', undefined, (draft) => {
              const i = draft.findIndex((r) => r.uid === data.uid);
              if (i >= 0) draft[i] = data;
            }),
          );
        } catch {
          patchResult.undo();
        }
      },
    }),
    deleteReportSchedule: build.mutation<{ success: boolean }, number>({
      query: (uid) => ({
        url: `/callcenter/report-schedules/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ReportSchedules'],
    }),
    runReportScheduleNow: build.mutation<{ success: boolean; error?: string }, number>({
      query: (uid) => ({
        url: `/callcenter/report-schedules/${uid}/run-now`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetReportQuery,
  useLazyGetReportQuery,
  useGetAgentTimelineQuery,
  useLazyExportReportQuery,
  useGetReportSchedulesQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useRunReportScheduleNowMutation,
} = callCenterReportsApi;
