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

export type ReportColumnType =
  | 'count'
  | 'percent'
  | 'duration'
  | 'agent'
  | 'queue'
  | 'datetime'
  | 'boolean'
  | 'text';

/** How the totals row of a column is built: sum, mean / rate weighted by `weightKey`, or the maximum. */
export type ReportColumnTotal = 'sum' | 'weighted' | 'max';

export interface ReportColumn {
  key: string;
  /** English title: CSV / XLSX / PDF and the fallback of `labelKey`. */
  header: string;
  /** What the value is - the UI formats by it (cc-ux U3.3). */
  type?: ReportColumnType;
  /** i18n key of the UI title. */
  labelKey?: string;
  total?: ReportColumnTotal;
  weightKey?: string;
  weightMinusKey?: string;
}

// Default `any` so runReport can return heterogeneous row shapes without variance fights.
export interface ReportResult<T = any> {
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
  /** Handled = answered + transferred. */
  answeredCalls: number;
  /** Lost calls beyond the short-abandon window. */
  abandonedCalls: number;
  /** Abandons within `short_abandon_sec`; excluded from SLA/answer/abandon denominators. */
  shortAbandonedCalls: number;
  transferredCalls: number;
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
  /** Shift length from cc_agent_sessions (login→logout/now) overlapping the period. */
  loggedInSec?: number;
  /** Sum of session.total_pause_time (filled on pause exit). */
  totalPauseSec?: number;
  /** Sum of session.total_idle_time (READY time accumulated on logout / transitions). */
  totalIdleSec?: number;
}

export interface PauseReportRow {
  agentInterface: string;
  userId: number;
  pauseReason: string;
  pauseCount: number;
  totalPauseSec: number;
  avgPauseSec: number;
  /** From cc_pause_reasons.is_paid; undefined when reason is not in the catalog. */
  isPaid?: boolean | null;
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
