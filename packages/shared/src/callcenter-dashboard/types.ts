/**
 * Call-center management dashboard contract (cc-analytics E1).
 * One response, independent sections: a section that cannot be built reports its own `source`
 * instead of failing the page or showing zeros. Tenant identity is never client input.
 */

export type CcDashboardPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export type CcDashboardSourceState = 'ok' | 'stale' | 'notConfigured' | 'error';

export interface CcDashboardSource {
  state: CcDashboardSourceState;
  /** ISO instant the section data was last refreshed; `null` when unknown. */
  updatedAt: string | null;
  message?: string;
}

export interface CcDashboardSection<T> {
  source: CcDashboardSource;
  /** `null` when the section is not available (see `source`). */
  data: T | null;
}

/** A tenant-local calendar window and the UTC instants it covers (`to` is exclusive). */
export interface CcDashboardWindow {
  /** Tenant-local `YYYY-MM-DD`. */
  dateFrom: string;
  dateTo: string;
  /** ISO UTC instants. For a period in progress `to` is trimmed to "now". */
  from: string;
  to: string;
}

export interface CcDashboardPeriod extends CcDashboardWindow {
  preset: CcDashboardPreset;
  timezone: string;
  /** Number of local calendar days in the period. */
  days: number;
  /** True when the period contains the tenant's current local day. */
  includesToday: boolean;
  /**
   * Comparison window of the same elapsed length: the same weekday a week earlier for "today",
   * the immediately preceding period otherwise. `null` when comparison is off.
   */
  previous: CcDashboardWindow | null;
}

/** Dictionary KPIs of one queue (or of all queues). Rates are percentages, times are seconds. */
export interface CcServiceKpis {
  offered: number;
  handled: number;
  abandoned: number;
  shortAbandoned: number;
  transferred: number;
  sla: number;
  asr: number;
  asa: number;
  aht: number;
  abandonRate: number;
  maxWait: number;
}

export interface CcDashboardService {
  current: CcServiceKpis;
  previous: CcServiceKpis | null;
}

export type CcDashboardSeriesGranularity = 'halfHour' | 'day';

export interface CcDashboardSeriesPoint {
  /** ISO UTC instant of the point start (local half hour / local day start). */
  at: string;
  offered: number;
  handled: number;
  abandoned: number;
  shortAbandoned: number;
  sla: number;
  abandonRate: number;
  asa: number;
  aht: number;
  /** Running service level from the first point of the period. */
  cumulativeSla: number;
  /** `false` before the first call so charts can leave the line empty. */
  hasTraffic: boolean;
}

export interface CcDashboardSeries {
  granularity: CcDashboardSeriesGranularity;
  points: CcDashboardSeriesPoint[];
  /** Previous window, aligned index by index with `points`. */
  previous: CcDashboardSeriesPoint[] | null;
}

export interface CcDashboardQueueRow {
  queueName: string;
  current: CcServiceKpis;
  previous: CcServiceKpis | null;
}

/** Live state for the "now" strip; only present when the period includes today. */
export interface CcDashboardNow {
  waiting: number;
  longestWaitSec: number;
  agents: { ready: number; busy: number; paused: number; wrapup: number; offline: number };
  /** Service level over the last 30 minutes (two quarter-hour buckets); `null` without traffic. */
  slaLast30: number | null;
  offeredLast30: number;
}

/**
 * Lost calls and what happened to them next (from the missed-call list). Each lost call is in exactly
 * one of: called back by an operator, the client called back on their own, or still waiting.
 */
export interface CcDashboardLosses {
  /** Real queue abandons in the period (personal / direct misses are not included). */
  total: number;
  /** Same figure for the comparison window; `null` when comparison is off. */
  previousTotal: number | null;
  /** An operator called the client back (`recoveredWithin15/60` are subsets of it). */
  recoveredByAgent: number;
  recoveredWithin15: number;
  recoveredWithin60: number;
  /** The client called back and nobody had to call them. */
  clientCalledBack: number;
  /** Nobody called back and the client did not either: the work list. */
  pending: number;
  /** How long the caller waited before hanging up (seconds). */
  waitBuckets: { upTo5: number; upTo20: number; upTo60: number; over60: number };
}

export interface CcDashboardPauseReason {
  /** Pause reason name; `(none)` when the operator paused without one. */
  reason: string;
  count: number;
  totalSec: number;
  /** From the pause-reason catalog; `null` when the reason is not catalogued. */
  isPaid: boolean | null;
}

/** Operator pauses in the period, by reason (the pause report folded across operators). */
export interface CcDashboardPauses {
  count: number;
  totalSec: number;
  paidSec: number;
  unpaidSec: number;
  /** Pauses whose reason is not in the catalog, so paid / unpaid is unknown. */
  unknownSec: number;
  /** Largest first. */
  reasons: CcDashboardPauseReason[];
  /** Total pause seconds of the comparison window; `null` when comparison is off. */
  previousTotalSec: number | null;
}

export type CcDashboardOperatorFlag = 'highAht' | 'highPause';

export interface CcDashboardOperatorOutlier {
  agentInterface: string;
  agentUserUid: number | null;
  callsHandled: number;
  ahtSec: number;
  /** Share of the logged-in time spent on pauses, percent. */
  pauseSharePct: number;
  loggedInSec: number;
  flags: CcDashboardOperatorFlag[];
}

/**
 * Operators who stand out from the others in the period. A flag is a reason to look, not a verdict:
 * the comparison is against the median of the operators that were evaluated.
 */
export interface CcDashboardOperators {
  /** Operators with enough calls / logged-in time to be compared. */
  evaluated: number;
  /** `null` when too few operators were evaluated for a median to mean anything. */
  medianAhtSec: number | null;
  medianPauseSharePct: number | null;
  /** Most flags first, then the largest gap. */
  outliers: CcDashboardOperatorOutlier[];
}

export interface CcDashboardOverview {
  version: 1;
  generatedAt: string;
  period: CcDashboardPeriod;
  /** Queue filter that was applied (empty = all queues the tenant has). */
  queues: string[];
  /** Queues the filter can choose from. */
  availableQueues: string[];
  now: CcDashboardSection<CcDashboardNow> | null;
  service: CcDashboardSection<CcDashboardService>;
  series: CcDashboardSection<CcDashboardSeries>;
  queueTable: CcDashboardSection<CcDashboardQueueRow[]>;
  losses: CcDashboardSection<CcDashboardLosses>;
  pauses: CcDashboardSection<CcDashboardPauses>;
  operators: CcDashboardSection<CcDashboardOperators>;
}

export const CC_DASHBOARD_LIMITS = {
  maxPeriodDays: 31,
  maxQueues: 50,
} as const;
