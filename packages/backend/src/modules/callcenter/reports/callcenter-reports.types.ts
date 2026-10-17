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
  /** `operator` = the value covers the whole person, not the queue filter. */
  scope?: 'operator';
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
  /** True when the requested window was cut to the maximum report length. */
  periodClamped?: boolean;
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
  /** Display name resolved on the server, so a finished shift still shows a person. */
  agentName?: string;
  agentExtens?: string[];
  callsHandled: number;
  totalTalkSec: number;
  totalHoldSec: number;
  totalWrapupSec: number;
  /** @deprecated Same number as `ahtSec`. Kept for older exports. */
  avgHandleSec?: number;
  ahtSec: number;
  avgTalkSec?: number;
  avgHoldSec?: number;
  avgWrapupSec?: number;
  /** Shift length overlapping the period, from the journal. */
  loggedInSec?: number;
  /** All pause seconds (paid + unpaid + unknown). */
  totalPauseSec?: number;
  /** Ready time. Historical name of the column was "idle". */
  totalIdleSec?: number;
  readySec?: number;
  busySec?: number;
  pausePaidSec?: number;
  pauseUnpaidSec?: number;
  pauseUnknownSec?: number;
  occupancyPct?: number;
  utilizationPct?: number;
  pauseSharePct?: number;
  rnaCount?: number;
  offeredCount?: number;
  answerRatePct?: number;
  /** Null when a queue filter makes "per hour" mix two scopes. */
  callsPerHour?: number | null;
  transferredCalls?: number;
  transferPct?: number;
  shortCalls?: number;
  shortCallPct?: number;
  outboundCalls?: number;
  outboundAnswered?: number;
  outboundTalkSec?: number;
  sessions?: number;
  firstLoginAt?: string | null;
  lastLogoutAt?: string | null;
  statDate?: string;
  queueName?: string;
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

export interface ReportAccess {
  /** null = every operator of the tenant. */
  operatorUserIds: number[] | null;
  /** Normalized queue tokens; null = every queue. */
  queues: string[] | null;
}

export interface ReportQuery {
  dateFrom: string;
  dateTo: string;
  queueName?: string;
  agentInterface?: string;
  /** One user id, or several separated by commas. */
  agentUserUid?: string;
  /** `day` = one row per person per day; `queue` = call metrics per queue. */
  groupBy?: 'operator' | 'day' | 'queue';
  /** `rna` = ring-no-answer offers instead of queue-call rows (call detail). */
  kind?: string;
  page?: number;
  pageSize?: number;
  access?: ReportAccess;
}
