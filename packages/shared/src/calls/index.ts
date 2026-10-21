/** One logical telephone call. Raw channel/context identifiers are not presentation fields. */
export type CallDirection = 'in' | 'out' | 'internal' | 'external';
export type CallOutcome =
  | 'human'
  | 'robot'
  | 'voicemail'
  | 'menu'
  | 'missed'
  | 'error'
  | 'unknown'
  | 'active';
export type CallActorKind =
  | 'employee'
  | 'queue'
  | 'menu'
  | 'voiceRobot'
  | 'aiRobot'
  | 'external'
  | 'unknown';
export interface CallParty {
  kind: CallActorKind;
  id: string | null;
  name: string | null;
  number: string | null;
  department: string | null;
}
export interface CallJourneyStep {
  id: string;
  kind:
    | 'received'
    | 'menu'
    | 'queue'
    | 'attempt'
    | 'conversation'
    | 'transfer'
    | 'voicemail'
    | 'robot'
    | 'ended';
  at: string;
  until: string | null;
  actor: CallParty | null;
  target: CallParty | null;
  result: 'answered' | 'noAnswer' | 'busy' | 'error' | 'unknown' | null;
  evidence: 'cdr' | 'cel' | 'module';
}
export interface CallRecording {
  id: string;
  startedAt: string;
  durationSec: number | null;
}
export interface CallAnalytics {
  state: 'none' | 'queued' | 'running' | 'analyzed' | 'failed';
  recordingId: string | null;
  runId: string | null;
  projectId: string | null;
}
export interface CallAnalysisMetric {
  id: string;
  label: string;
  value: string | number | boolean | string[] | null;
  unit: string | null;
  min: number | null;
  max: number | null;
  rationale: string | null;
  /** Omitted for legacy results. Null with an explicit state is intentional, not a zero score. */
  status?: 'assessed' | 'not_applicable' | 'insufficient_evidence';
  quote?: string | null;
}
export interface CallAnalysisPage {
  state: 'available' | 'unavailable';
  callId: string;
  runId: string | null;
  projectName: string | null;
  analyzedAt: string | null;
  summary: string | null;
  summaryTruncated: boolean;
  metrics: CallAnalysisMetric[];
  timingAdjusted: boolean;
  privacyProtected: boolean;
}
export interface CallRecord {
  id: string;
  startedAt: string;
  endedAt: string | null;
  direction: CallDirection;
  outcome: CallOutcome;
  reason: string | null;
  origin: 'telephony' | 'autodial' | 'ai';
  caller: CallParty;
  recipient: CallParty;
  companyNumber: string | null;
  participants: CallParty[];
  handling: CallActorKind[];
  durationSec: number;
  connectedSec: number | null;
  waitSec: number | null;
  timingSource?: 'cel' | 'cdr' | null;
  recordings: CallRecording[];
  hasVoicemail: boolean;
  voicemailCallId?: string | null;
  analytics: CallAnalytics | null;
  journey: CallJourneyStep[];
  route?: CallRoute;
  historyComplete: boolean;
  businessOutcome: 'unknown';
}
export interface CallSummary {
  total: number;
  incoming: number;
  /** Outbound direction only, over the entire filtered cohort. Optional for older API clients. */
  outgoing?: number;
  /** Sum of known human connection intervals over the cohort, not average × row count. */
  totalConnectedSec?: number | null;
  human: number;
  robot: number;
  voicemail: number;
  menu: number;
  missed: number;
  error: number;
  unknown: number;
  active: number;
  incomingHuman: number;
  incomingRobot: number;
  incomingMissed: number;
  acceptedPercent: number | null;
  classifiedPercent: number | null;
  avgConnectedSec: number | null;
  connectedSample: number;
  estimatedConnectedSample: number;
}
export interface CallsQuery {
  /** Initiating employee's extension/identity in the existing call party model; not mere participation. */
  callerEmployee?: string;
  focusEmployee?: string;
  focusDepartment?: string;
  focusCompanyNumber?: string;
  attentionView?: 'open' | 'all';
  unassignedDimensions?: CallOverviewDimension[];
  focusOutcome?: CallOutcome;
  from?: string;
  to?: string;
  origin?: 'telephony' | 'autodial' | 'ai';
  dashboardOutcome?: 'accepted' | 'missed' | 'unknown' | 'active';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  /** Facet catalogue search only; never changes the call cohort. */
  directorySearch?: string;
  direction?: CallDirection;
  outcome?: CallOutcome;
  handling?: CallActorKind | 'autodial';
  extension?: string;
  companyNumber?: string;
  department?: string;
  employees?: string[];
  departments?: string[];
  companyNumbers?: string[];
  queues?: string[];
  robots?: string[];
  outcomes?: CallOutcome[];
  recording?: 'yes' | 'no';
  voicemail?: '1';
  analytics?: CallAnalytics['state'];
  cursor?: string;
  limit?: number;
}
export type CallDimension =
  | 'employee'
  | 'department'
  | 'companyNumber'
  | 'queue'
  | 'robot';
export interface CallFacetOption {
  value: string;
  label: string;
  count: number;
}
export interface CallsFacets {
  contextKey?: string;
  options: Record<CallDimension, CallFacetOption[]>;
  truncated: Partial<Record<CallDimension, boolean>>;
  analyticsAllowed: boolean;
  dataAsOf: string | null;
}
export interface CallRouteNode {
  id: string;
  kind: CallJourneyStep['kind'] | 'attempts';
  steps: CallJourneyStep[];
  /** Overlap in CDR alone is only a possible fork, never proven parallel ringing. */
  possibleParallel: boolean;
}
export interface CallRoute {
  nodes: CallRouteNode[];
  coverage: 'partial';
}
export interface CallTranscriptPage {
  state: 'ready' | 'unavailable';
  callId: string;
  runId: string | null;
  transcriptId: string | null;
  /** Authorized CDR recording identity for transcript-relative audio offsets. */
  recordingId?: string | null;
  segments: Array<{ id: string; ordinal: number; startMs: number; endMs: number; speaker: 'client' | 'employee' | 'unknown'; text: string; textTruncated: boolean }>;
  nextCursor: string | null;
}
export interface CallTextSearchPage {
  mode: 'literal'|'semantic';
  semantic?: {state:'ready'|'indexing'|'unavailable'|'error';model:string|null;profile:string|null;dimension:number|null;indexedWindows:number;totalWindows:number;verification?:{providerUid:number;model:string;profile:string}};
  rows: Array<{callId:string;caller:CallParty;recipient:CallParty;startedAt:string;runId:string;transcriptId:string;segmentId:string;startMs:number;endMs:number;speaker:'client'|'employee'|'unknown';snippet:string}>;
  timezone:string;
  period:{from:string;to:string};
  dataAsOf:string;
  coverage:{cohortCalls:number;consideredCalls:number;eligibleCalls:number;scannedSegments:number;matchingSegments:number};
  partialReasons:Array<'call_limit'|'identity_limit'|'run_limit'|'segment_limit'|'segment_text_limit'|'match_limit'|'window_limit'|'window_text_limit'|'indexing'|'verification_limit'|'privacy_limited'>;
  limits:{calls:number;segments:number;segmentChars:number;matches:number};
}
export interface CallsPage {
  transcriptSearchAllowed?: boolean;
  transcriptSemanticAllowed?:boolean;
  /** Actual server-resolved interval; freeze it when opening an AI investigation. */
  period?: { from: string; to: string };
  rows: CallRecord[];
  total: number;
  nextCursor: string | null;
  summary: CallSummary;
  timezone: string;
  dataAsOf: string | null;
  projectionVersion: string;
  source: {
    state: 'ok' | 'stale' | 'unavailable';
    message: string | null;
    progress: number | null;
  };
}
export function normalizeCallNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('8')
    ? `7${digits.slice(1)}`
    : digits;
}
/** Union of half-open intervals; transfers and parallel ringing never double count. */
export function callIntervalSeconds(
  intervals: ReadonlyArray<readonly [number, number]>,
): number {
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a, b]) => [a, b])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let from = 0;
  let until = 0;
  for (const [a, b] of sorted) {
    if (a > until) {
      total += until - from;
      from = a;
      until = b;
    } else until = Math.max(until, b);
  }
  return Math.round((total + until - from) / 1000);
}
export interface CallAggregate {
  direction: CallDirection;
  outcome: CallOutcome;
  count: number;
  connectedTotal: number;
  connectedSample: number;
  estimatedConnectedSample?: number;
}
export function summarizeCalls(calls: readonly CallRecord[]): CallSummary {
  return summarizeCallGroups(
    calls.map((call) => ({
      direction: call.direction,
      outcome: call.outcome,
      count: 1,
      connectedTotal: call.connectedSec || 0,
      connectedSample:
        call.outcome === 'human' && call.connectedSec !== null ? 1 : 0,
      estimatedConnectedSample:
        call.outcome === 'human' &&
        call.connectedSec !== null &&
        call.timingSource === 'cdr'
          ? 1
          : 0,
    })),
  );
}
export function summarizeCallGroups(
  groups: readonly CallAggregate[],
): CallSummary {
  const result: CallSummary = {
    total: 0,
    incoming: 0,
    outgoing: 0,
    human: 0,
    robot: 0,
    voicemail: 0,
    menu: 0,
    missed: 0,
    error: 0,
    unknown: 0,
    active: 0,
    incomingHuman: 0,
    incomingRobot: 0,
    incomingMissed: 0,
    acceptedPercent: null,
    classifiedPercent: null,
    avgConnectedSec: null,
    connectedSample: 0,
    estimatedConnectedSample: 0,
  };
  let connected = 0;
  let incomingUnknown = 0;
  let incomingActive = 0;
  for (const call of groups) {
    result.total += call.count;
    result[call.outcome] += call.count;
    if (call.direction === 'out') result.outgoing = (result.outgoing ?? 0) + call.count;
    if (call.direction === 'in') {
      result.incoming += call.count;
      if (call.outcome === 'human') result.incomingHuman += call.count;
      if (call.outcome === 'robot') result.incomingRobot += call.count;
      if (call.outcome === 'missed') result.incomingMissed += call.count;
      if (call.outcome === 'unknown') incomingUnknown += call.count;
      if (call.outcome === 'active') incomingActive += call.count;
    }
    if (call.outcome === 'human') {
      connected += call.connectedTotal;
      result.connectedSample += call.connectedSample;
      result.estimatedConnectedSample += call.estimatedConnectedSample || 0;
    }
  }
  const denominator = result.incoming - incomingActive;
  result.acceptedPercent = denominator
    ? Math.round(
        (100 * (result.incomingHuman + result.incomingRobot)) / denominator,
      )
    : null;
  result.classifiedPercent = denominator
    ? Math.round((100 * (denominator - incomingUnknown)) / denominator)
    : null;
  result.totalConnectedSec = result.connectedSample ? connected : (result.human || result.unknown ? null : 0);
  result.avgConnectedSec = result.connectedSample
    ? Math.round(connected / result.connectedSample)
    : null;
  return result;
}

export interface CallOverviewBucket {
  from: string;
  to: string;
  total: number;
  human: number;
  missed: number;
  unknown: number;
}
export interface CallCalendarDay extends CallOverviewBucket {
  date: string;
  hours: Array<CallOverviewBucket & { hour: number; offsetMinutes: number }>;
}
/** A bounded, ACL-scoped snapshot. Calendar hours retain distinct DST occurrences. */
export interface CallsOverview {
  summary: CallSummary;
  breakdowns?: CallBreakdown[];
  calendar?: { days: CallCalendarDay[]; bucketUnit: 'hour' | 'day' };
  previous: CallSummary;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  buckets: Array<{
    from: string;
    to: string;
    total: number;
    human: number;
    missed: number;
    unknown: number;
  }>;
  timezone: string;
  dataAsOf: string | null;
  projectionVersion: string;
  source: CallsPage['source'];
}

export type CallOverviewDimension = 'employee' | 'department' | 'companyNumber';
export interface CallBreakdownRow {
  value: string | null;
  label: string | null;
  total: number;
  previousTotal: number;
  human: number;
  missed: number;
  unknown: number;
}
export interface CallBreakdown {
  dimension: CallOverviewDimension;
  rows: CallBreakdownRow[];
  unassigned: CallBreakdownRow;
  truncated: boolean;
}
export type CallAttentionState =
  | 'waiting'
  | 'overdue'
  | 'outboundConnected'
  | 'customerReturned'
  | 'unknown';
export interface CallAttentionCase {
  id: string;
  firstCallId: string;
  lastCallId: string;
  sourceCalls: number;
  number: string | null;
  companyNumber: string | null;
  firstAt: string;
  lastAt: string;
  deadline: string;
  state: CallAttentionState;
  reason:
    | 'sameNumberAndCompany'
    | 'missingNumber'
    | 'missingCompany'
    | 'incompleteHistory';
  attempt: { callId: string; at: string } | null;
  contact: { callId: string; at: string } | null;
}
export interface CallsAttention {
  policy: {
    windowHours: number;
    outcomes: Array<'missed' | 'voicemail'>;
    matching: 'numberAndCompany';
    businessResolution: false;
  };
  snapshotAt: string;
  timezone: string;
  scopeLimited: boolean;
  coverage: 'complete' | 'partial';
  source: CallsPage['source'];
  totals: Record<CallAttentionState, number> & {
    sourceCalls: number;
    groups: number;
    attempted: number;
  };
  rows: CallAttentionCase[];
  truncated: boolean;
}
