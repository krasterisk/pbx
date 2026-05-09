// ─── Agent ────────────────────────────────────────────────

export type AgentStatus = 'OFFLINE' | 'READY' | 'IN_CALL' | 'RINGING' | 'PAUSED' | 'WRAPUP';

export interface IAgent {
  interface: string;
  name: string;
  status: AgentStatus;
  pauseReason?: string;
  currentCall?: string;
  queues: string[];
  callsTaken: number;
  lastCallTime?: string;
  loginTime?: string;
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
}
