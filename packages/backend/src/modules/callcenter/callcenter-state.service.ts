/**
 * CallCenter In-Memory State Store.
 *
 * Maintains a real-time snapshot of all agents, queues, and active calls.
 * Updated by AMI events (via CallCenterAmiService), never queried from DB.
 * Provides RxJS Subject streams for SSE push to browsers.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { CcEventBusEvent, mapCcEventToBusEvent } from './cc-event-bus.types';

export type { CcEventBusEvent } from './cc-event-bus.types';

// ─── Types ──────────────────────────────────────────────

export type AgentStatus =
  | 'OFFLINE'
  | 'READY'
  | 'IN_CALL'
  | 'RINGING'
  | 'PAUSED'
  | 'WRAPUP'
  /** Phase 9 (D-08/D-13): outbound dial in progress, on a consult leg, after-call-work. */
  | 'DIALING'
  | 'CONSULT'
  | 'ACW'
  /** Queue-paused outbound work mode — no inbound, dial-out allowed, counts as working time. */
  | 'OUTBOUND_WORK';

export interface AgentState {
  interface: string;        // PJSIP/e101_42
  name: string;             // display name
  status: AgentStatus;
  pauseReason?: string;
  currentCall?: string;     // uniqueid of active call
  queues: string[];         // queue names this agent belongs to
  callsTaken: number;
  /** Session queue RINGNOANSWER (+ personal/outbound miss) count. */
  callsMissed: number;
  /** Session outbound/internal answered count (DialEnd ANSWER). */
  callsMade: number;
  /** Outbound dial target while status is DIALING (cleared on DialEnd/Hangup). */
  dialTarget?: string;
  lastCallTime?: Date;
  loginTime?: Date;
  /** Wall-clock when the current `status` was entered (operator timer / auto-pause). */
  statusSince?: Date;
  wrapupTimeout?: number;
  wrapupExtendStep?: number;
  wrapupAutosaveDraft?: boolean;
  userUid: number;          // tenant
  userId: number;           // user id
}

export interface QueueState {
  name: string;
  displayName: string;
  strategy: string;
  waiting: number;
  talking: number;
  agents: { total: number; available: number; paused: number; busy: number };
  sla: number;              // % for today
  calls: { answered: number; abandoned: number; total: number };
  avgWait: number;          // seconds
  avgTalk: number;          // seconds
  userUid: number;
}

export type CallStatus = 'WAITING' | 'RINGING' | 'TALKING' | 'HOLD' | 'TRANSFERRED';

export interface CallState {
  uniqueid: string;
  callerIdNum: string;
  callerIdName: string;
  queue: string;
  agent?: string;           // agent interface (e.g. PJSIP/e101_42)
  callerChannel?: string;   // actual Asterisk channel (e.g. PJSIP/trunk-00000001)
  agentChannel?: string;    // agent's Asterisk channel (e.g. PJSIP/e101_42-00000002)
  status: CallStatus;
  enterTime: Date;
  answerTime?: Date;
  holdTime: number;         // accumulated seconds on hold
  talkTime: number;         // accumulated seconds talking
  position?: number;        // position in queue
  userUid: number;
  /** Phase 9 (D-27/D-28): flagged by CallCenterZombieService, cleared by resetZombieCall. */
  zombieCandidate?: boolean;
}

export interface CcEvent {
  type: string;             // SSE event type: agentUpdate, queueUpdate, callNew, etc.
  userUid: number;          // tenant — used for SSE filtering
  data: any;
}

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class CallCenterStateService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterStateService.name);

  /** Per-tenant agent states. Key = `${userUid}:${agentInterface}` */
  private readonly agents = new Map<string, AgentState>();

  /** Per-tenant queue states. Key = `${userUid}:${queueName}` */
  private readonly queues = new Map<string, QueueState>();

  /** Active calls. Key = uniqueid */
  private readonly activeCalls = new Map<string, CallState>();

  /** RxJS Subject for all CC events — SSE subscribers filter by userUid */
  private readonly eventSubject = new Subject<CcEvent>();

  /** Incrementing event ID for SSE Last-Event-ID support */
  private eventSeqId = 0;

  onModuleInit() {
    this.logger.log('CallCenter State Store initialized');
  }

  // ─── Event Stream (for SSE) ─────────────────────────────

  /**
   * Returns an Observable filtered by tenant.
   * Used by the SSE controller to push events to the correct tenant.
   */
  getEventStream(userUid: number): Observable<CcEvent> {
    return this.eventSubject.asObservable().pipe(
      filter(event => event.userUid === userUid),
    );
  }

  /**
   * SSE stream for a logged-in operator: JWT tenant OR the queue-suffix tenant
   * where they currently have an online agent (fixes q700_0 vs vpbx=58 mismatch).
   */
  getEventStreamForUser(jwtUserUid: number, userId: number): Observable<CcEvent> {
    return this.eventSubject.asObservable().pipe(
      filter((event) => {
        if (event.userUid === jwtUserUid) return true;
        const agentTenant = this.findTenantForOnlineUser(userId);
        return agentTenant != null && event.userUid === agentTenant;
      }),
    );
  }

  /**
   * Typed overlay over getEventStream (D-41a).
   * Maps known event types into CcEventBusEvent; drops unmapped legacy SSE noise.
   * Does NOT duplicate the Subject — same underlying stream.
   */
  getTypedEventStream(userUid: number): Observable<CcEventBusEvent> {
    return this.getEventStream(userUid).pipe(
      map((event) => mapCcEventToBusEvent(event.type, event.data)),
      filter((e): e is CcEventBusEvent => e !== null),
    );
  }

  /** Emit an event to all SSE subscribers of a tenant */
  emitEvent(type: string, userUid: number, data: any): void {
    this.eventSeqId++;
    this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
  }

  // ─── Agent State ────────────────────────────────────────

  private agentKey(userUid: number, iface: string): string {
    return `${userUid}:${iface}`;
  }

  getAgent(userUid: number, iface: string): AgentState | undefined {
    return this.agents.get(this.agentKey(userUid, iface));
  }

  getAllAgents(userUid: number): AgentState[] {
    const result: AgentState[] = [];
    for (const agent of this.agents.values()) {
      if (agent.userUid === userUid) result.push(agent);
    }
    return result;
  }

  /**
   * Resolve the AgentState whose interface matches an Asterisk channel (D-08).
   * Channels look like `PJSIP/e101_42-00000005` — the interface is the prefix
   * before the Asterisk-assigned `-xxxxxxxx` call sequence suffix.
   * Never resolves tenant from a queue suffix (Pitfall 1) — only from the
   * matched AgentState.userUid — and only matches agents who are actually
   * logged in (userId > 0), so a stray/unknown channel cannot inject
   * status/KPI updates for another tenant (T-09-03-01).
   */
  findAgentByChannel(channel: string): AgentState | undefined {
    if (!channel) return undefined;
    for (const agent of this.agents.values()) {
      if (!agent.userId || agent.userId <= 0) continue;
      if (channel === agent.interface || channel.startsWith(`${agent.interface}-`)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Tenant bucket where this login has an online agent (queue suffix may differ from JWT vpbx).
   */
  findTenantForOnlineUser(userId: number): number | null {
    for (const agent of this.agents.values()) {
      if (agent.userId === userId && agent.status !== 'OFFLINE') {
        return agent.userUid;
      }
    }
    return null;
  }

  /** Snapshot for SSE: prefer the tenant where the user is actually logged into queues. */
  getSnapshotForUser(jwtUserUid: number, userId: number) {
    const tenant = this.findTenantForOnlineUser(userId) ?? jwtUserUid;
    return { tenant, snapshot: this.getSnapshot(tenant) };
  }

  setAgent(userUid: number, iface: string, state: Partial<AgentState>): AgentState {
    const key = this.agentKey(userUid, iface);
    const existing = this.agents.get(key);
    const prevQueues = existing?.queues ?? [];
    const prevStatus = existing?.status;
    const updated: AgentState = {
      interface: iface,
      name: '',
      status: 'OFFLINE',
      queues: [],
      callsTaken: 0,
      callsMissed: 0,
      callsMade: 0,
      userUid,
      userId: 0,
      ...(existing || {}),
      ...state,
    };
    // Stamp when status actually changes so UI timers survive refresh / remount
    if (state.statusSince != null) {
      updated.statusSince =
        state.statusSince instanceof Date
          ? state.statusSince
          : new Date(state.statusSince as unknown as string);
    } else if (!existing || existing.status !== updated.status) {
      updated.statusSince = new Date();
    } else if (!updated.statusSince) {
      updated.statusSince = existing?.statusSince ?? new Date();
    }
    // Leaving PAUSED / OUTBOUND_WORK must clear reason — undefined is dropped by JSON.stringify (SSE).
    // Keep reason while DIALING so we can resume the prior pause/outbound-work mode after the dial.
    if (
      updated.status !== 'PAUSED'
      && updated.status !== 'OUTBOUND_WORK'
      && updated.status !== 'DIALING'
    ) {
      delete updated.pauseReason;
    }
    this.agents.set(key, updated);
    // Explicit null so SSE clients clear the previous reason label
    const keepReason =
      updated.status === 'PAUSED'
      || updated.status === 'OUTBOUND_WORK'
      || updated.status === 'DIALING';
    const payload = keepReason ? updated : { ...updated, pauseReason: null };
    this.emitEvent('agentUpdate', userUid, payload);

    // Keep queue free/paused/busy counts in sync (login/pause/dial often skip AMI recalc).
    const queuesChanged =
      prevQueues.length !== updated.queues.length
      || prevQueues.some((q) => !updated.queues.includes(q));
    if (!existing || prevStatus !== updated.status || queuesChanged) {
      const affected = new Set([...prevQueues, ...updated.queues]);
      for (const queueName of affected) {
        this.recomputeQueueAgentStats(userUid, queueName);
      }
    }

    return updated;
  }

  removeAgent(userUid: number, iface: string): void {
    const key = this.agentKey(userUid, iface);
    const existing = this.agents.get(key);
    this.agents.delete(key);
    this.emitEvent('agentUpdate', userUid, { interface: iface, status: 'OFFLINE', removed: true });
    if (existing?.queues?.length) {
      for (const queueName of existing.queues) {
        this.recomputeQueueAgentStats(userUid, queueName);
      }
    }
  }

  /**
   * Refresh queue.agents.* from live agent statuses.
   * OFFLINE (Invalid / unreachable) members are excluded from totals.
   */
  recomputeQueueAgentStats(userUid: number, queueName: string): void {
    if (!this.getQueue(userUid, queueName)) return;

    const live = this.getAllAgents(userUid).filter(
      (a) => a.queues.includes(queueName) && a.status !== 'OFFLINE',
    );

    this.setQueue(userUid, queueName, {
      agents: {
        total: live.length,
        available: live.filter((a) => a.status === 'READY').length,
        paused: live.filter((a) =>
          a.status === 'PAUSED' || a.status === 'OUTBOUND_WORK'
        ).length,
        busy: live.filter((a) =>
          a.status === 'IN_CALL'
          || a.status === 'RINGING'
          || a.status === 'DIALING'
          || a.status === 'CONSULT'
          || a.status === 'WRAPUP'
          || a.status === 'ACW'
        ).length,
      },
    });
  }

  // ─── Queue State ────────────────────────────────────────

  private queueKey(userUid: number, name: string): string {
    return `${userUid}:${name}`;
  }

  getQueue(userUid: number, name: string): QueueState | undefined {
    return this.queues.get(this.queueKey(userUid, name));
  }

  getAllQueues(userUid: number): QueueState[] {
    const result: QueueState[] = [];
    for (const q of this.queues.values()) {
      if (q.userUid === userUid) result.push(q);
    }
    return result;
  }

  setQueue(userUid: number, name: string, state: Partial<QueueState>): QueueState {
    const key = this.queueKey(userUid, name);
    const existing = this.queues.get(key);
    const updated: QueueState = {
      name,
      displayName: name,
      strategy: 'ringall',
      waiting: 0,
      talking: 0,
      agents: { total: 0, available: 0, paused: 0, busy: 0 },
      sla: 100,
      calls: { answered: 0, abandoned: 0, total: 0 },
      avgWait: 0,
      avgTalk: 0,
      userUid,
      ...(existing || {}),
      ...state,
    };
    this.queues.set(key, updated);
    this.emitEvent('queueUpdate', userUid, updated);
    return updated;
  }

  // ─── Call State ─────────────────────────────────────────

  getCall(uniqueid: string): CallState | undefined {
    return this.activeCalls.get(uniqueid);
  }

  getAllCalls(userUid: number): CallState[] {
    const result: CallState[] = [];
    for (const call of this.activeCalls.values()) {
      if (call.userUid === userUid) result.push(call);
    }
    return result;
  }

  setCall(uniqueid: string, state: Partial<CallState>): CallState {
    const existing = this.activeCalls.get(uniqueid);
    const updated: CallState = {
      uniqueid,
      callerIdNum: '',
      callerIdName: '',
      queue: '',
      status: 'WAITING',
      enterTime: new Date(),
      holdTime: 0,
      talkTime: 0,
      userUid: 0,
      ...(existing || {}),
      ...state,
    };
    this.activeCalls.set(uniqueid, updated);

    const eventType = existing ? 'callUpdate' : 'callNew';
    this.emitEvent(eventType, updated.userUid, updated);
    return updated;
  }

  removeCall(uniqueid: string, reason?: string): void {
    const call = this.activeCalls.get(uniqueid);
    if (call) {
      this.activeCalls.delete(uniqueid);
      this.emitEvent('callEnd', call.userUid, { ...call, reason });
    }
  }

  /**
   * Get ALL active calls across all tenants.
   * Used by Hold/Unhold AMI handlers that receive channel name without tenant context.
   */
  getAllCallsGlobal(): CallState[] {
    return Array.from(this.activeCalls.values());
  }

  // ─── Snapshot (for initial SSE connection) ──────────────

  getSnapshot(userUid: number) {
    return {
      agents: this.getAllAgents(userUid),
      queues: this.getAllQueues(userUid),
      calls: this.getAllCalls(userUid),
    };
  }
}
