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
  }),
});

export const {
  useGetReportQuery,
  useLazyGetReportQuery,
  useGetAgentTimelineQuery,
  useLazyExportReportQuery,
} = callCenterReportsApi;
