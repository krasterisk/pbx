/**
 * Call Center reports types (D-33 / D-34 backend).
 * reportId is a closed whitelist — never accept arbitrary strings into SQL.
 */

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

export function isCcReportId(value: string): value is CcReportId {
  return (CC_REPORT_IDS as readonly string[]).includes(value);
}

export interface ReportColumn {
  key: string;
  header: string;
}

// Default `any` so runReport can return heterogeneous row shapes without variance fights.
export interface ReportResult<T = any> {
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
  /** 0–6 (Sun–Sat) or ISO weekday label */
  dayOfWeek: number;
  hour: number;
  callCount: number;
}

/** Shared contract with CallCenterService.getAgentDetail / AgentTimeline (D-36). */
export interface AgentTimelineSegment {
  state: string;
  startTs: string;
  endTs: string;
  durationSec: number;
  reason?: string;
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

export interface ReportQuery {
  dateFrom: string;
  dateTo: string;
  queueName?: string;
  agentInterface?: string;
  page?: number;
  pageSize?: number;
}
