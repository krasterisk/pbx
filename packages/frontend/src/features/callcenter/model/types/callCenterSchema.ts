// ─── Agent ────────────────────────────────────────────────

export type AgentStatus =
  | 'OFFLINE'
  | 'READY'
  | 'IN_CALL'
  | 'RINGING'
  | 'PAUSED'
  | 'WRAPUP'
  | 'DIALING'
  | 'CONSULT'
  | 'ACW'
  /** Queue-paused outbound work — no inbound, dial-out allowed. */
  | 'OUTBOUND_WORK';

export interface IAgent {
  interface: string;
  name: string;
  status: AgentStatus;
  pauseReason?: string;
  currentCall?: string;
  queues: string[];
  callsTaken: number;
  /** Session queue RINGNOANSWER (+ personal/outbound miss) count. */
  callsMissed?: number;
  /** Session outbound/internal answered count. */
  callsMade?: number;
  /** Outbound dial target while DIALING. */
  dialTarget?: string;
  /**
   * Since-midnight answered/made/missed (metrics). Used when panel KPI mode is day/both.
   * Shift counters stay on callsTaken / callsMade / callsMissed.
   */
  kpiDay?: { answered: number; made: number; missed: number };
  lastCallTime?: string;
  loginTime?: string;
  /** ISO timestamp when current status was entered (from server). */
  statusSince?: string;
  wrapupTimeout?: number;
  userUid: number;
  userId: number;
}

// ─── Queue ────────────────────────────────────────────────

export interface IQueueStats {
  name: string;
  displayName: string;
  strategy: string;
  waiting: number;
  talking: number;
  agents: { total: number; available: number; paused: number; busy: number };
  sla: number;
  calls: { answered: number; abandoned: number; total: number };
  avgWait: number;
  avgTalk: number;
  userUid: number;
}

// ─── Call ─────────────────────────────────────────────────

export type CallStatus = 'WAITING' | 'RINGING' | 'TALKING' | 'HOLD' | 'TRANSFERRED';

export interface ICall {
  uniqueid: string;
  callerIdNum: string;
  callerIdName: string;
  queue: string;
  agent?: string;
  callerChannel?: string;
  agentChannel?: string;
  status: CallStatus;
  enterTime: string;
  answerTime?: string;
  holdTime: number;
  talkTime: number;
  position?: number;
  userUid: number;
  /** Phase 9 (D-27/D-28): flagged by the backend zombie reconciler, cleared by resetZombieCall.
   *  Flows through the existing callUpdate SSE merge — no dedicated listener needed. */
  zombieCandidate?: boolean;
}

// ─── Snapshot ─────────────────────────────────────────────

export interface ICcSnapshot {
  agents: IAgent[];
  queues: IQueueStats[];
  calls: ICall[];
}

// ─── Pause Reason ─────────────────────────────────────────

export interface IPauseReason {
  uid: number;
  name: string;
  color: string;
  max_duration: number;
  is_paid: boolean;
  sort_order: number;
}

// ─── Redux State ──────────────────────────────────────────

export interface CallCenterState {
  agents: IAgent[];
  queues: IQueueStats[];
  calls: ICall[];
  connected: boolean;
  myAgentInterface: string | null;
  chatUnreadByChannel: Record<string, number>;
  chatOpen: boolean;
  /** WebRTC softphone: number to dial once registered (click-to-call / history). */
  pendingOutboundDial: string | null;
}

export interface IChatMessagePayload {
  uid: number;
  channel_key: string;
  channel_type: string;
  sender_user_id: number;
  sender_name?: string | null;
  body: string;
  created_at: string;
}

// ─── Agent Detail / Timeline (D-36 contract, owner 07-09) ─

export interface AgentTimelineSegment {
  state: string;
  startTs: string;
  endTs: string;
  durationSec: number;
  reason?: string;
}

export interface IAgentDetail {
  stats: {
    status: string;
    pauseReason?: string;
    callsHandled: number;
    callsTaken: number;
    totalTalk: number;
    aht: number;
    totalHold: number;
    queues: string[];
  };
  segments: AgentTimelineSegment[];
}

export interface ICcKpiSample {
  t: number;
  waiting: number;
  talking: number;
  freeAgents: number;
  sla: number;
  avgWait: number;
  abandoned: number;
}
