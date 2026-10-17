import { rtkApi } from '../rtkApi';
import type { AgentTimelineSegment } from '@/features/callcenter/model/types/callCenterSchema';

/** Closed whitelist - mirrors backend callcenter-reports.types.ts */
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

export type ReportColumnType =
  | 'count'
  | 'percent'
  | 'duration'
  | 'agent'
  | 'queue'
  | 'datetime'
  | 'boolean'
  | 'text';

export interface ReportColumn {
  key: string;
  /** English title (CSV / XLSX / PDF and the fallback of `labelKey`). */
  header: string;
  /** What the value is - the UI formats by it (cc-ux U3.3). */
  type?: ReportColumnType;
  /** i18n key of the UI title. */
  labelKey?: string;
  /** Totals row: sum, mean / rate weighted by `weightKey`, or maximum. */
  total?: 'sum' | 'weighted' | 'max';
  weightKey?: string;
  /** Denominator is `weightKey - weightMinusKey`. */
  weightMinusKey?: string;
}

export interface ReportResult<T = Record<string, unknown>> {
  reportId: CcReportId;
  timezone?: string;
  generatedAt?: string;
  periodStart?: string;
  periodEnd?: string;
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
  /** Abandons within the tenant short-abandon window (excluded from rate denominators). */
  shortAbandonedCalls?: number;
  transferredCalls?: number;
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

export type QueueIntervalGranularity = 15 | 30 | 60;

/** One intraday point (mirrors backend QueueIntervalPoint; rates are percentages, times seconds). */
export interface QueueIntervalPoint {
  /** ISO instant of the interval start. */
  start: string;
  offered: number;
  answered: number;
  abandoned: number;
  shortAbandoned: number;
  transferred: number;
  sla: number;
  asr: number;
  asa: number;
  aht: number;
  abandonRate: number;
  maxWait: number;
  /** Running totals since the first point of the range. */
  cumulativeOffered: number;
  cumulativeSla: number;
}

export interface QueueIntervalsResult {
  /** Tenant IANA timezone - labels must be rendered in it, not in the browser zone. */
  timezone: string;
  granularityMin: QueueIntervalGranularity;
  from: string;
  to: string;
  rows: QueueIntervalPoint[];
  /** Same range one week earlier, aligned index by index (when compare=weekAgo). */
  previous?: QueueIntervalPoint[];
}

/** Per-queue SLA of the last half hour against the half hour before (supervisor tile trend). */
export interface QueueRecentSla {
  queueName: string;
  offered: number;
  /** `null` when the window has no countable traffic. */
  sla: number | null;
  previousSla: number | null;
}

export interface QueueIntervalsParams {
  /** Tenant-local YYYY-MM-DD; both default to the tenant's current day on the server. */
  dateFrom?: string;
  dateTo?: string;
  granularityMin?: QueueIntervalGranularity;
  queueName?: string;
  compare?: 'weekAgo';
}

export interface AgentTimelineQueryParams {
  agentInterface: string;
  /** Single day - mapped to dateFrom/dateTo */
  date: string;
}

export interface ExportReportParams extends ReportQueryParams {
  reportId: CcReportId;
  format: 'csv' | 'xlsx';
}

/** Scheduled report delivery config (D-35) - mirrors backend CcReportSchedule */
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
  overrideExisting: import.meta.hot != null,
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
    getQueueIntervals: build.query<QueueIntervalsResult, QueueIntervalsParams | void>({
      query: (params) => ({
        url: '/callcenter/intervals/queues',
        params: params ?? undefined,
      }),
    }),
    getRecentQueueSla: build.query<QueueRecentSla[], void>({
      query: () => '/callcenter/intervals/queues/recent',
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
    getReportSchedulePreview: build.query<{ nextRunAt: string; timezone: string }, ReportSchedulePayload>({
      query: (body) => ({ url: '/callcenter/report-schedules/preview', method: 'POST', body }),
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
  useGetQueueIntervalsQuery,
  useGetRecentQueueSlaQuery,
  useLazyExportReportQuery,
  useGetReportSchedulesQuery,
  useGetReportSchedulePreviewQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useRunReportScheduleNowMutation,
} = callCenterReportsApi;
