/**
 * CallCenter AMI Event Listener.
 *
 * Subscribes to relevant AMI events from the existing AmiService
 * and updates the in-memory CallCenterStateService.
 * Maps raw Asterisk AMI events ? structured CC state changes.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ModuleRef } from '@nestjs/core';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService, AgentStatus, AgentState } from './callcenter-state.service';
import { CallCenterHistoryWriterService } from './callcenter-history-writer.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterAutoPauseService } from './callcenter-autopause.service';
import { CcAgentEvent } from './models/agent-event.model';
import { CcMissedCall } from './models/missed-call.model';
import { CcAgentSession } from './models/agent-session.model';
import { Queue } from '../queues/queue.model';
import {
  companionIdOf,
  interfaceToExtension,
  isWebrtcCompanion,
  primaryIdOf,
} from '../endpoints/endpoint-ids.util';

@Injectable()
export class CallCenterAmiService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterAmiService.name);

  /** Tracks pending wrapup auto-timeout timers. Key = `${userUid}:${agentInterface}` */
  private readonly wrapupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Tracks wrap-up deadline timestamps (ms). Key = `${userUid}:${agentInterface}` */
  private readonly wrapupDeadlines = new Map<string, number>();

  /** In-process dedupe for missed-call inserts (AMI reconnect / multi-handler races). */
  private readonly loggedMissedUniqueids = new Set<string>();

  /**
   * Channels currently ringing a personal/direct call (not queue-driven),
   * mapped to the caller info captured at Newchannel time. Populated by
   * handleNewchannel, consumed/cleared by handleAgentHangup so a hangup
   * while ringing on a direct call counts as a personal missed call
   * without misclassifying in-queue Ring-No-Answer (D-08/D-10/D-20).
   */
  private readonly personalRingingChannels = new Map<string, { callerIdNum: string; callerIdName: string }>();

  /**
   * Open non-queue call attempts awaiting their history row (D-34/D-35).
   * Seeded by handleDialBegin (outbound/internal) or handleNewchannel
   * (personal direct ring), consumed by handleDialEnd/handleAgentHangup once
   * the attempt resolves (answered/missed/cancelled). Key = `${userUid}:${agentInterface}`.
   */
  private readonly nonQueueCallStates = new Map<string, {
    uniqueid: string;
    direction: 'outbound' | 'personal' | 'internal';
    callerIdNum: string;
    callerIdName: string;
    enterTime: Date;
    answerTime?: Date;
    /** Status to restore after dial ends (READY / PAUSED / OUTBOUND_WORK). */
    resumeStatus?: AgentStatus;
  }>();

  /** Warn only once if CallCenterService isn't resolvable via ModuleRef. */
  private warnedMissingCcService = false;

  /**
   * Open timed status journal rows awaiting exit (duration fill).
   * Covers DIALING/CONSULT/ACW plus PAUSE / CALL_START / WRAPUP_START for
   * working-time and pause reports. Key = `${userUid}:${agentInterface}`.
   */
  private readonly statusJournalEntries = new Map<string, {
    uid: number;
    enteredAt: number;
    eventType: string;
    sessionId: number;
  }>();

  /** Timed statuses that write a duration-backed journal row. */
  static readonly TIMED_STATUS_EVENTS = [
    'DIALING', 'CONSULT', 'ACW', 'PAUSE', 'CALL_START', 'WRAPUP_START',
  ] as const;

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly historyWriter: CallCenterHistoryWriterService,
    private readonly metricsService: CallCenterMetricsService,
    private readonly autoPauseService: CallCenterAutoPauseService,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
    @InjectModel(CcAgentSession) private readonly agentSessionModel: typeof CcAgentSession,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Lazily resolve CallCenterService to avoid a circular module dependency (same pattern as AmiService.getCcAmiService). */
  private getCcService(): { autoResolveOnAnswer: (userUid: number, callerIdNum: string) => Promise<void> } | null {
    try {
      return this.moduleRef.get('CallCenterService', { strict: false });
    } catch {
      if (!this.warnedMissingCcService) {
        this.warnedMissingCcService = true;
        this.logger.warn('CallCenterService not resolvable via ModuleRef — missed-call auto-resolve disabled');
      }
      return null;
    }
  }

  async onModuleInit() {
    // Wait a bit for AMI connection to establish
    setTimeout(() => this.initialize(), 3000);
  }

  private async initialize() {
    try {
      // Load initial queue states via QueueStatus AMI action
      await this.loadInitialState();
      this.logger.log('? CallCenter AMI listener initialized');
    } catch (err: any) {
      this.logger.warn(`CallCenter AMI init deferred: ${err.message}`);
    }
  }

  /**
   * Load current queue/agent state from Asterisk via QueueStatus AMI command.
   * QueueStatus triggers multiple response events:
   *  - QueueParams  ? one per queue (strategy, weight, calls, etc.)
   *  - QueueMember  ? one per member in each queue (interface, status, paused)
   *  - QueueEntry   ? one per waiting caller in each queue
   *  - QueueStatusComplete ? final "done" event
   *
   * We collect them all and populate the in-memory state store.
   */
  async loadInitialState(): Promise<void> {
    if (!this.amiService.isConnected()) {
      this.logger.debug('AMI not connected yet, skipping initial state load');
      return;
    }

    // Build DB queue?tenant map
    const dbQueues = await this.queueModel.findAll({ attributes: ['name', 'user_uid', 'display_name'] });
    const queueTenantMap = new Map<string, { userUid: number; displayName: string }>();
    for (const q of dbQueues) {
      queueTenantMap.set(q.getDataValue('name'), {
        userUid: q.getDataValue('user_uid'),
        displayName: q.getDataValue('display_name') || q.getDataValue('name'),
      });
    }

    if (queueTenantMap.size === 0) {
      this.logger.debug('No queues in DB, nothing to preload');
      return;
    }

    // Collect events from AMI via temporary listeners
    const members: any[] = [];
    const entries: any[] = [];
    const queueParams: any[] = [];

    const ami = (this.amiService as any).ami;
    if (!ami) {
      this.logger.warn('AMI instance not available for initial state load');
      return;
    }

    // Set up temporary event collectors
    const onQueueParams = (evt: any) => queueParams.push(evt);
    const onQueueMember = (evt: any) => members.push(evt);
    const onQueueEntry = (evt: any) => entries.push(evt);

    ami.on('queueparams', onQueueParams);
    ami.on('queuemember', onQueueMember);
    ami.on('queueentry', onQueueEntry);

    try {
      // Fire QueueStatus AMI action ? triggers the events above
      await this.amiService.queueStatus();

      // Wait briefly for async events to arrive
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err: any) {
      this.logger.warn(`QueueStatus command failed: ${err.message}`);
    } finally {
      // Remove temporary listeners
      ami.removeListener('queueparams', onQueueParams);
      ami.removeListener('queuemember', onQueueMember);
      ami.removeListener('queueentry', onQueueEntry);
    }

    // Process collected QueueParams ? initialize queue stats
    for (const qp of queueParams) {
      const qName = qp.queue;
      if (!qName) continue;
      const tenant = queueTenantMap.get(qName);
      if (!tenant) continue;

      this.stateService.setQueue(tenant.userUid, qName, {
        displayName: tenant.displayName,
        strategy: qp.strategy || 'ringall',
        waiting: parseInt(qp.calls, 10) || 0,
        talking: 0,
        agents: { total: 0, available: 0, paused: 0, busy: 0 },
        // Never seed from Asterisk lifetime Completed/Abandoned — those grow across
        // days/reloads and confuse operators vs status-bar shift KPIs (D-31/D-32).
        // Use in-memory since-midnight metrics (restoreToday / live AMI).
        ...(() => {
          const metrics = this.metricsService.getQueueMetrics(tenant.userUid, qName);
          return {
            sla: metrics.sla || parseFloat(qp.servicelevel) || 0,
            calls: {
              answered: metrics.answered,
              abandoned: metrics.abandoned,
              total: metrics.offered,
            },
            avgWait: metrics.asa || parseInt(qp.holdtime, 10) || 0,
            avgTalk: metrics.aht || parseInt(qp.talktime, 10) || 0,
          };
        })(),
      });
    }

    // Process collected QueueMembers ? initialize agent states
    for (const m of members) {
      const qName = m.queue;
      const iface = m.interface || m.name;
      if (!qName || !iface) continue;

      const tenant = queueTenantMap.get(qName);
      if (!tenant) continue;

      const existingAgent = this.stateService.getAgent(tenant.userUid, iface);
      const existingQueues = existingAgent?.queues || [];
      if (!existingQueues.includes(qName)) existingQueues.push(qName);

      this.stateService.setAgent(tenant.userUid, iface, {
        queues: existingQueues,
        name: this.pickAgentDisplayName(iface, m.name || m.membername, existingAgent?.name),
        status: this.mapAsteriskStatus(m.status, m.paused),
        pauseReason: m.paused === '1' ? (m.pausedreason || '') : undefined,
        // Asterisk CallsTaken is cumulative ? keep session counter once operator is logged in
        callsTaken:
          existingAgent?.userId
            ? (existingAgent.callsTaken ?? 0)
            : (parseInt(m.callstaken, 10) || 0),
        callsMissed: existingAgent?.callsMissed ?? 0,
        callsMade: existingAgent?.callsMade ?? 0,
        lastCallTime: m.lastcall && m.lastcall !== '0' ? new Date(parseInt(m.lastcall, 10) * 1000) : undefined,
      });
    }

    // Process collected QueueEntries ? initialize waiting calls
    for (const e of entries) {
      const qName = e.queue;
      const uniqueid = e.uniqueid;
      if (!qName || !uniqueid) continue;

      const tenant = queueTenantMap.get(qName);
      if (!tenant) continue;

      this.stateService.setCall(uniqueid, {
        callerIdNum: e.calleridnum || '',
        callerIdName: e.calleridname || '',
        queue: qName,
        status: 'WAITING',
        enterTime: new Date(Date.now() - (parseInt(e.wait, 10) || 0) * 1000),
        position: parseInt(e.position, 10) || 0,
        userUid: tenant.userUid,
      });
    }

    // Recalculate queue stats with actual agent counts
    for (const [qName, tenant] of queueTenantMap) {
      this.recalcQueueStats(tenant.userUid, qName);
    }

    // Mid-call Nest restart: QueueMember shows In use but QueueEntry only has
    // WAITING — rebuild TALKING bindings from CoreShowChannels.
    await this.reconcileActiveAgentCalls();

    this.logger.log(
      `? Initial state loaded: ${queueParams.length} queues, ${members.length} members, ${entries.length} waiting calls`,
    );
  }

  /**
   * Rebuild agent.currentCall + CallState for agents that are busy (IN_CALL /
   * RINGING / DIALING) but lost their call binding (Nest restart, Leave race).
   * Safe to call on every SSE connect — no-ops when nothing is missing.
   */
  async reconcileActiveAgentCalls(): Promise<void> {
    if (!this.amiService.isConnected()) return;

    const needy = this.stateService.getAllAgentsGlobal().filter((a) => {
      if (a.status !== 'IN_CALL' && a.status !== 'RINGING' && a.status !== 'DIALING') {
        return false;
      }
      if (!a.currentCall) return true;
      return !this.stateService.getCall(a.currentCall);
    });
    if (needy.length === 0) return;

    let events: any[] = [];
    try {
      const res = await this.amiService.getActiveChannels();
      events = res.events || [];
    } catch (err: any) {
      this.logger.warn(`reconcileActiveAgentCalls: CoreShowChannels failed: ${err?.message || err}`);
      return;
    }
    if (events.length === 0) return;

    let repaired = 0;
    for (const agent of needy) {
      const prefixes = this.agentInterfacePrefixes(agent.interface);
      const agentEvt = events.find((evt) => {
        const ch = String(evt.channel || '');
        return prefixes.some((p) => ch === p || ch.startsWith(`${p}-`));
      });
      if (!agentEvt) continue;

      const bridgeId = String(agentEvt.bridgeid || agentEvt.bridgeuniqueid || '').trim();
      const peerEvt = bridgeId
        ? events.find((evt) => {
          const bid = String(evt.bridgeid || evt.bridgeuniqueid || '').trim();
          return bid === bridgeId && String(evt.channel || '') !== String(agentEvt.channel || '');
        })
        : undefined;

      const callerIdNum = String(
        peerEvt?.calleridnum
        || agentEvt.connectedlinenum
        || agentEvt.calleridnum
        || agent.peerNumber
        || '',
      ).trim();
      const callerIdName = String(
        peerEvt?.calleridname
        || agentEvt.connectedlinename
        || agentEvt.calleridname
        || '',
      ).trim();
      const uniqueid = String(
        peerEvt?.linkedid
        || peerEvt?.uniqueid
        || agentEvt.linkedid
        || agentEvt.uniqueid
        || '',
      ).trim();
      if (!uniqueid) continue;

      const status =
        agent.status === 'RINGING' || agent.status === 'DIALING'
          ? (agent.status === 'RINGING' ? 'RINGING' : 'TALKING')
          : 'TALKING';

      this.stateService.setCall(uniqueid, {
        callerIdNum,
        callerIdName,
        callerChannel: peerEvt?.channel || undefined,
        agentChannel: agentEvt.channel || undefined,
        agent: agent.interface,
        status: status === 'RINGING' ? 'RINGING' : 'TALKING',
        answerTime: status === 'RINGING' ? undefined : new Date(),
        userUid: agent.userUid,
        queue: agent.queues[0] || '',
      });
      this.stateService.setAgent(agent.userUid, agent.interface, {
        currentCall: uniqueid,
        ...(callerIdNum ? { peerNumber: callerIdNum } : {}),
      });
      repaired += 1;
    }

    if (repaired > 0) {
      this.logger.log(`reconcileActiveAgentCalls: restored ${repaired} active call binding(s)`);
    }
  }

  /** PJSIP interface + optional WebRTC/primary twin prefixes for channel matching. */
  private agentInterfacePrefixes(agentInterface: string): string[] {
    const related = new Set<string>([agentInterface]);
    const slash = agentInterface.indexOf('/');
    const tech = slash >= 0 ? agentInterface.slice(0, slash + 1) : '';
    const sipId = slash >= 0 ? agentInterface.slice(slash + 1) : agentInterface;
    const twin = isWebrtcCompanion(sipId) ? primaryIdOf(sipId) : companionIdOf(sipId);
    if (twin) related.add(`${tech}${twin}`);
    return [...related];
  }

  // ??? AMI Event Handlers ??????????????????????????????????
  // These are called from AmiService event listeners.
  // We'll register them when we extend ami.service.ts to forward CC events.

  /**
   * Handle QueueMemberStatus / QueueMemberAdded / QueueMemberPause events.
   * Updates agent state in the in-memory store.
   */
  handleAgentStatusEvent(evt: any): void {
    const queueName = evt.queue;
    const iface = evt.interface || evt.membername;
    if (!queueName || !iface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    // Prefer the logged-in WebRTC/primary twin over a queue-preload phantom on
    // the companion interface (QueueMemberStatus may report either side).
    const viaChannel = this.stateService.findAgentByChannel(iface);
    const existing =
      viaChannel && viaChannel.userUid === userUid
        ? viaChannel
        : this.stateService.getAgent(userUid, iface);
    const agentIface = existing?.userId ? existing.interface : iface;

    const paused = evt.paused === '1' || evt.paused === 1 || evt.paused === true;
    let status = this.mapAsteriskStatus(evt.status, evt.paused);
    const amiStatusCode = String(evt.status ?? '');
    // Logged-in operator: temporary SIP/WebRTC Unavailable must not end the shift.
    // Browser tab throttle often drops WSS → Asterisk status 5 → would show "Start shift".
    // Status 4 (Invalid) means the endpoint cannot take calls — keep OFFLINE.
    if (status === 'OFFLINE' && existing?.userId && amiStatusCode !== '4') {
      if (paused || existing.status === 'PAUSED' || existing.status === 'OUTBOUND_WORK') {
        status = existing.status === 'OUTBOUND_WORK' ? 'OUTBOUND_WORK' : 'PAUSED';
      } else if (
        existing.status === 'IN_CALL'
        || existing.status === 'RINGING'
        || existing.status === 'WRAPUP'
        || existing.status === 'DIALING'
        || existing.status === 'CONSULT'
        || existing.status === 'ACW'
      ) {
        status = existing.status;
      } else {
        status = 'READY';
      }
    }
    // Outbound dial: device goes "In use" before remote answer — keep DIALING
    // until DialEnd ANSWER / fail (otherwise coworkers show Talking too early).
    // Only remap In-use/Ringing from a live unanswered outbound — never READY:
    // after the softphone/dialplan ends the channel, Asterisk reports Not in use
    // while DialEnd/Hangup may be missed (Busy/Congestion/Hangup app) — remapping
    // READY→DIALING left a phantom "Calling · Outbound" forever.
    const pendingNonQueue = this.nonQueueCallStates.get(this.journalKey(userUid, agentIface));
    const unansweredOutbound = Boolean(
      pendingNonQueue
      && !pendingNonQueue.answerTime
      && (pendingNonQueue.direction === 'outbound' || pendingNonQueue.direction === 'internal'),
    );
    if (
      !paused
      && (
        (existing?.status === 'DIALING' && (status === 'IN_CALL' || status === 'RINGING'))
        || (unansweredOutbound && (status === 'IN_CALL' || status === 'RINGING'))
      )
    ) {
      status = 'DIALING';
    }
    // Device free while we still show DIALING — dial ended; clear phantom state.
    const releaseStaleDial = !paused && status === 'READY' && existing?.status === 'DIALING';
    if (releaseStaleDial) {
      this.clearNonQueueDialAttempt(userUid, agentIface);
    }
    // Personal inbound answered (device In use while RINGING) — stamp answerTime for journal.
    if (
      status === 'IN_CALL'
      && pendingNonQueue?.direction === 'personal'
      && !pendingNonQueue.answerTime
    ) {
      pendingNonQueue.answerTime = new Date();
    }
    // Queue-paused "outbound work" mode must survive AMI QueueMemberPause remap to PAUSED
    // (including the brief window before setAgent(OUTBOUND_WORK), via pausedreason).
    const amiReasonEarly = (evt.pausedreason || evt.reason || '').trim();
    if (
      paused
      && (existing?.status === 'OUTBOUND_WORK' || amiReasonEarly === 'outbound_work')
    ) {
      status = 'OUTBOUND_WORK';
    }
    // Asterisk QueueMemberPause / QueueMember use PausedReason > pausedreason
    const amiReason = amiReasonEarly;
    let pauseReason: string | undefined;
    if (status === 'OUTBOUND_WORK') {
      pauseReason = existing?.pauseReason || 'outbound_work';
    } else if (paused || status === 'PAUSED') {
      pauseReason = amiReason || existing?.pauseReason || undefined;
    } else {
      pauseReason = ''; // clear for SSE (setAgent > pauseReason: null)
    }

    const updated = this.stateService.setAgent(userUid, agentIface, {
      status,
      pauseReason,
      // Clear outbound label when AMI reports Not in use after a failed dial.
      ...(releaseStaleDial ? { dialTarget: undefined, peerNumber: '' } : {}),
      // Session counter (agentLogin resets to 0); do not import Asterisk lifetime CallsTaken
      callsTaken:
        existing?.userId != null && existing.userId > 0
          ? (existing.callsTaken ?? 0)
          : (parseInt(evt.callstaken, 10) || existing?.callsTaken || 0),
      callsMissed: existing?.callsMissed ?? 0,
      callsMade: existing?.callsMade ?? 0,
      name: this.pickAgentDisplayName(agentIface, evt.membername, existing?.name),
    });

    this.metricsService.recordAgentStatus(userUid, agentIface, status);
    void this.autoPauseService.evaluateOnStatusEvent(userUid, agentIface, status, updated.queues, updated.lastCallTime);
  }

  /**
   * Handle QueueCallerJoin ? a caller entered a queue.
   */
  handleCallerJoin(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName || !uniqueid) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    this.stateService.setCall(uniqueid, {
      callerIdNum: evt.calleridnum || '',
      callerIdName: evt.calleridname || '',
      callerChannel: evt.channel || '',
      queue: queueName,
      status: 'WAITING',
      enterTime: new Date(),
      position: parseInt(evt.position, 10) || 0,
      userUid,
    });

    // Update queue waiting count
    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle QueueCallerLeave — caller left the queue without AgentComplete
   * (timeout, redirect, abandon race). Clears orphan WAITING rows only.
   *
   * After answer Asterisk also emits Leave (caller dequeued into the bridge).
   * Must NOT remove RINGING (agent already offered — Connect may still be
   * in flight) or TALKING/HOLD — that wiped callerIdNum and left the UI on
   * "Unknown" / empty client card. Abandon / RNA / AgentComplete own those.
   */
  handleCallerLeave(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const key = this.resolveCallerCallKey(evt, userUid) || uniqueid || null;
    if (key) {
      const call = this.stateService.getCall(key);
      if (call) {
        const keepForConnectRace =
          call.status === 'TALKING'
          || call.status === 'HOLD'
          || call.status === 'TRANSFERRED'
          || (call.status === 'RINGING' && !!call.agent);
        if (keepForConnectRace) {
          this.recalcQueueStats(userUid, queueName);
          return;
        }
      }
      this.stateService.removeCall(key, 'left');
    }

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AgentConnect — an agent answered a queued call.
   */
  handleAgentConnect(evt: any): void {
    const queueName = evt.queue;
    const rawInterface = evt.interface || evt.membername;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const member = this.resolveMemberAgent(userUid, rawInterface);
    const agentInterface = member?.interface || rawInterface;

    const uniqueid = this.resolveCallerCallKey(evt, userUid);
    if (!uniqueid) return;

    // Drop mistaken entries keyed by agent-channel uniqueid (destuniqueid missing)
    const agentUid = evt.uniqueid;
    if (agentUid && agentUid !== uniqueid) {
      const mistaken = this.stateService.getCall(agentUid);
      if (mistaken && mistaken.queue === queueName) {
        this.stateService.removeCall(agentUid, 'merged');
      }
    }

    // AgentConnect event fields (asterisk-manager lowercases):
    //   channel      = agent's channel  (e.g. PJSIP/e101_42-00000002)
    //   destchannel  = caller's channel (e.g. PJSIP/trunk-00000001)
    const agentChannel = evt.channel || '';
    const callerChannel = evt.destchannel || '';

    const existingCall = this.stateService.getCall(uniqueid);
    const callerIdNum = String(
      existingCall?.callerIdNum
      || evt.calleridnum
      || evt.connectedlinenum
      || '',
    ).trim();
    const callerIdName = String(
      existingCall?.callerIdName
      || evt.calleridname
      || evt.connectedlinename
      || '',
    ).trim();

    this.stateService.setCall(uniqueid, {
      agent: agentInterface,
      agentChannel,
      callerChannel: callerChannel || existingCall?.callerChannel || undefined,
      status: 'TALKING',
      answerTime: new Date(),
      userUid,
      queue: queueName,
      ...(callerIdNum ? { callerIdNum } : {}),
      ...(callerIdName ? { callerIdName } : {}),
    });

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'IN_CALL',
      currentCall: uniqueid,
      // Mirror CID on the agent so status bar / colleagues survive F5 even if
      // the CallState row is briefly missing from the snapshot.
      ...(callerIdNum ? { peerNumber: callerIdNum } : {}),
    });

    this.metricsService.recordAgentStatus(userUid, agentInterface, 'IN_CALL');

    const connectedAgent = this.stateService.getAgent(userUid, agentInterface);
    if (connectedAgent) {
      void this.beginTimedStatus(connectedAgent, 'CALL_START', '', {
        callUniqueid: uniqueid,
        queueName,
      });
    }

    // D-17: a client answering after a prior miss auto-resolves their open
    // missed-call rows. Lives on CallCenterService (missedCallModel owner);
    // resolved lazily via ModuleRef to avoid a circular constructor dependency.
    const answeredCall = this.stateService.getCall(uniqueid);
    if (answeredCall?.callerIdNum) {
      void this.getCcService()?.autoResolveOnAnswer(userUid, answeredCall.callerIdNum);
    }

    this.stateService.emitEvent('callAnswer', userUid, {
      uniqueid,
      queue: queueName,
      agent: agentInterface,
      holdTime: evt.holdtime || '0',
      status: 'TALKING',
      callerIdNum: answeredCall?.callerIdNum || callerIdNum || '',
      callerIdName: answeredCall?.callerIdName || callerIdName || '',
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AgentComplete — call finished (agent or caller hung up).
   */
  handleAgentComplete(evt: any): void {
    const queueName = evt.queue;
    const rawInterface = evt.interface || evt.membername;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    // Prefer logged-in WebRTC/primary twin (same as QueueMemberStatus).
    const agent = this.resolveMemberAgent(userUid, rawInterface);
    const agentInterface = agent?.interface || rawInterface;
    const uniqueid =
      this.resolveCallerCallKey(evt, userUid)
      || agent?.currentCall
      || evt.destuniqueid
      || evt.uniqueid
      || undefined;

    // Snapshot call before remove — needed for history row (batched writer, D-09)
    const call = uniqueid ? this.stateService.getCall(uniqueid) : undefined;
    let talkSec = 0;
    const wasAnswered = Boolean(call?.answerTime);

    if (uniqueid && wasAnswered) {
      const enterTime = call?.enterTime;
      const answerTime = call!.answerTime!;
      const endTime = new Date();
      const waitSec =
        enterTime
          ? Math.max(0, Math.round((answerTime.getTime() - enterTime.getTime()) / 1000))
          : (parseInt(evt.holdtime, 10) || 0);
      talkSec = Math.max(0, Math.round((endTime.getTime() - answerTime.getTime()) / 1000));
      const wrapupSec = agent?.wrapupTimeout || 0;
      const kpiIface = agentInterface || call?.agent || '';

      this.metricsService.recordAnswered(
        userUid,
        queueName,
        kpiIface,
        waitSec,
        talkSec,
        wrapupSec,
      );
      this.publishQueueMetrics(userUid, queueName);

      this.historyWriter.enqueue({
        call_uniqueid: uniqueid,
        queue_name: queueName,
        agent_interface: kpiIface,
        agent_user_uid: agent?.userId ?? undefined,
        caller_id_num: call?.callerIdNum || evt.calleridnum || '',
        caller_id_name: call?.callerIdName || evt.calleridname || '',
        enter_time: enterTime,
        answer_time: answerTime,
        end_time: endTime,
        wait_time: waitSec,
        talk_time: talkSec,
        hold_time: call?.holdTime || 0,
        disposition: 'answered',
        direction: 'inbound',
        position: call?.position || 0,
        user_uid: userUid,
      });
    }

    // Remove call from active (+ agent.currentCall if uniqueid mismatched)
    if (uniqueid) {
      this.stateService.removeCall(uniqueid, 'completed');
    }
    if (agent?.currentCall && agent.currentCall !== uniqueid) {
      this.stateService.removeCall(agent.currentCall, 'completed');
    }
    // Orphan WAITING rows left when connect used the wrong uniqueid key
    if (call?.callerChannel) {
      for (const orphan of this.stateService.getAllCalls(userUid)) {
        if (
          orphan.uniqueid !== uniqueid
          && orphan.queue === queueName
          && (orphan.status === 'WAITING' || orphan.status === 'RINGING')
          && orphan.callerChannel === call.callerChannel
        ) {
          this.stateService.removeCall(orphan.uniqueid, 'completed');
        }
      }
    }

    // Agent transitions to WRAPUP (if wrapuptime > 0) or READY.
    // callsTaken only when the call was actually answered (not unanswered dial).
    const agentAfter = agentInterface
      ? this.stateService.getAgent(userUid, agentInterface)
      : undefined;
    if (agentAfter) {
      const nextTaken = wasAnswered
        ? (agentAfter.callsTaken || 0) + 1
        : (agentAfter.callsTaken || 0);
      const wrapupTime = agentAfter.wrapupTimeout || 0;

      // Close CALL_START (or DIALING) journal; accumulate talk on the session.
      void this.endTimedStatus(agentAfter).then((callJournalSec) => {
        const talk = talkSec || callJournalSec;
        if (wasAnswered && talk > 0) {
          void this.incrementSessionTotals(agentAfter.userId, agentInterface, {
            total_talk_time: talk,
            total_calls: 1,
          });
        }
      });

      if (wrapupTime > 0 && wasAnswered) {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'WRAPUP',
          currentCall: undefined,
          callsTaken: nextTaken,
          lastCallTime: new Date(),
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'WRAPUP');
        const wrapAgent = this.stateService.getAgent(userUid, agentInterface);
        if (wrapAgent) void this.beginTimedStatus(wrapAgent, 'WRAPUP_START');
        this.stateService.emitEvent('wrapupStart', userUid, {
          agent: agentInterface,
          timeout: wrapupTime,
        });

        // Auto-timeout: transition to READY after wrapupTime seconds
        const timerKey = `${userUid}:${agentInterface}`;
        const deadline = Date.now() + wrapupTime * 1000;
        this.wrapupDeadlines.set(timerKey, deadline);
        this.clearWrapupTimer(timerKey);
        this.wrapupTimers.set(timerKey, setTimeout(() => {
          this.wrapupTimers.delete(timerKey);
          this.wrapupDeadlines.delete(timerKey);
          // Only transition if agent is still in WRAPUP
          const currentAgent = this.stateService.getAgent(userUid, agentInterface);
          if (currentAgent?.status === 'WRAPUP') {
            void this.endTimedStatus(currentAgent);
            this.stateService.setAgent(userUid, agentInterface, { status: 'READY' });
            this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
            void this.logAgentEventForAgent(currentAgent, 'WRAPUP_END', 'timeout');
            this.stateService.emitEvent('wrapupEnd', userUid, {
              agent: agentInterface,
              reason: 'timeout',
              autosaveDraft: currentAgent.wrapupAutosaveDraft,
            });
            this.logger.debug(`Wrapup auto-expired for ${agentInterface} after ${wrapupTime}s`);
          }
        }, wrapupTime * 1000));
      } else {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'READY',
          currentCall: undefined,
          callsTaken: nextTaken,
          lastCallTime: wasAnswered ? new Date() : agentAfter.lastCallTime,
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
        if (wasAnswered) {
          void this.logAgentEventForAgent(agentAfter, 'CALL_END');
        }
      }

      // Emit after callsTaken bump so agentUpdate + agentKpiUpdate stay aligned (D-11/D-45).
      if (wasAnswered && agentInterface) {
        this.emitKpiUpdate(userUid, agentInterface, queueName);
      }
    } else if (wasAnswered && agentInterface) {
      this.emitKpiUpdate(userUid, agentInterface, queueName);
    }

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Cancel a pending wrapup timer (e.g. agent manually ends wrapup).
   * Called from callcenter.service.ts when agent clicks "Ready for next".
   */
  cancelWrapupTimer(userUid: number, agentInterface: string): void {
    const key = `${userUid}:${agentInterface}`;
    this.clearWrapupTimer(key);
    this.wrapupDeadlines.delete(key);
  }

  /**
   * Extend an active wrap-up timer by addSeconds.
   * Emits wrapupExtend SSE event for frontend countdown resync.
   */
  extendWrapupTimer(userUid: number, agentInterface: string, addSeconds: number): void {
    const timerKey = `${userUid}:${agentInterface}`;
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent || agent.status !== 'WRAPUP') return;

    const now = Date.now();
    const currentDeadline = this.wrapupDeadlines.get(timerKey) ?? now;
    const newDeadline = Math.max(currentDeadline, now) + addSeconds * 1000;
    this.wrapupDeadlines.set(timerKey, newDeadline);

    this.clearWrapupTimer(timerKey);
    const remainingMs = newDeadline - now;
    const remainingSec = Math.ceil(remainingMs / 1000);

    this.wrapupTimers.set(timerKey, setTimeout(() => {
      this.wrapupTimers.delete(timerKey);
      this.wrapupDeadlines.delete(timerKey);
      const currentAgent = this.stateService.getAgent(userUid, agentInterface);
      if (currentAgent?.status === 'WRAPUP') {
        this.stateService.setAgent(userUid, agentInterface, { status: 'READY' });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
        this.stateService.emitEvent('wrapupEnd', userUid, {
          agent: agentInterface,
          reason: 'timeout',
          autosaveDraft: currentAgent.wrapupAutosaveDraft,
        });
        this.logger.debug(`Wrapup auto-expired for ${agentInterface} after extension`);
      }
    }, remainingMs));

    this.stateService.emitEvent('wrapupExtend', userUid, {
      agent: agentInterface,
      remainingSec,
      timeout: agent.wrapupTimeout ?? 0,
    });
  }

  private clearWrapupTimer(key: string): void {
    const existing = this.wrapupTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.wrapupTimers.delete(key);
    }
  }

  /**
   * Handle AgentCalled — queue offered a call to a member (phone starts ringing).
   * Sets RINGING so RONA / missed_count can see the agent on later Abandon / RNA.
   * QueueMemberStatus(6) is not always emitted before Abandon on all Asterisk setups.
   *
   * Updates the existing QueueCallerJoin row (caller uniqueid) — never inserts a
   * second call keyed by destuniqueid (that duplicated Waiting rows).
   * Binds agent.currentCall so the operator UI shows queue (not Personal) during ring.
   */
  handleAgentCalled(evt: any): void {
    const queueName = evt.queue;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName || !agentInterface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const existing = this.stateService.getAgent(userUid, agentInterface);
    // Only track members already known in CC state (shift login / QueueMember).
    if (!existing) return;

    const queues = existing.queues.includes(queueName)
      ? existing.queues
      : [...existing.queues, queueName];

    // Prefer the caller uniqueid (same key as QueueCallerJoin); fall back to
    // any WAITING/RINGING row already in this queue.
    const callerUniqueid = evt.uniqueid as string | undefined;
    const destUniqueid = evt.destuniqueid as string | undefined;
    let callKey: string | undefined;
    if (callerUniqueid && this.stateService.getCall(callerUniqueid)) {
      callKey = callerUniqueid;
    } else {
      const inQueue = this.stateService
        .getAllCalls(userUid)
        .find(
          (c) =>
            c.queue === queueName
            && (c.status === 'WAITING' || c.status === 'RINGING'),
        );
      callKey = inQueue?.uniqueid;
    }

    if (callKey) {
      this.stateService.setCall(callKey, {
        status: 'RINGING',
        agent: agentInterface,
      });
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'RINGING',
      queues,
      ...(callKey ? { currentCall: callKey } : {}),
    });
    this.metricsService.recordAgentStatus(userUid, agentInterface, 'RINGING');

    // Drop accidental orphan from older AgentCalled logic (destuniqueid key).
    if (destUniqueid && destUniqueid !== callKey) {
      const orphan = this.stateService.getCall(destUniqueid);
      if (orphan && orphan.queue === queueName && !orphan.callerIdNum) {
        this.stateService.removeCall(destUniqueid, 'merged');
      }
    }

    this.logger.debug(`AgentCalled: ${agentInterface} on ${queueName}`);
  }

  /**
   * Handle AgentRingNoAnswer — member did not answer before queue ring timeout.
   * Counts toward missed_count; fires RONA for this agent (event itself is the
   * signal — do not require live RINGING; QMS often clears it first).
   */
  handleAgentRingNoAnswer(evt: any): void {
    const queueName = evt.queue;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName || !agentInterface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) return;

    // Session coworker KPI: every queue RINGNOANSWER counts as missed.
    this.stateService.setAgent(userUid, agentInterface, {
      callsMissed: (agent.callsMissed || 0) + 1,
    });
    this.metricsService.recordMissed(userUid, agentInterface, queueName);
    this.emitKpiUpdate(userUid, agentInterface, queueName);

    // Durable RNA row so F5 / Nest restart can rebuild sinceLogin missed (D-31 KPI).
    // Not a personal missed-call worklist row (D-10/D-20) — history only.
    if (agent.userId) {
      const callUid = (evt.uniqueid as string | undefined)
        || agent.currentCall
        || `rna:${agentInterface}:${Date.now()}`;
      const liveCall = this.stateService.getCall(callUid);
      this.historyWriter.enqueue({
        call_uniqueid: callUid,
        queue_name: queueName,
        agent_interface: agentInterface,
        agent_user_uid: agent.userId,
        caller_id_num: liveCall?.callerIdNum || evt.calleridnum || '',
        caller_id_name: liveCall?.callerIdName || evt.calleridname || '',
        enter_time: liveCall?.enterTime || new Date(),
        end_time: new Date(),
        wait_time: 0,
        talk_time: 0,
        disposition: 'timeout',
        direction: 'inbound',
        user_uid: userUid,
      });
    }

    // Already paused / outbound-work / on a live call — leave RONA / status alone
    if (
      agent.status === 'PAUSED'
      || agent.status === 'OUTBOUND_WORK'
      || agent.status === 'IN_CALL'
      || agent.status === 'WRAPUP'
    ) {
      return;
    }

    const queues = agent.queues.includes(queueName)
      ? agent.queues
      : [...agent.queues, queueName];

    void (async () => {
      await this.autoPauseService.evaluateOnMissed(userUid, agentInterface, queues);
      // RONA-at-1 when no missed_count rule (skips itself if missed_count set)
      await this.autoPauseService.evaluateRonaForAgent(userUid, agentInterface, queues);
      const live = this.stateService.getAgent(userUid, agentInterface);
      if (!live) return;
      if (live.status === 'RINGING') {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'READY',
          currentCall: undefined,
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
      } else if (live.currentCall) {
        // PAUSED by RONA or READY via QMS — drop the unanswered offer bind
        this.stateService.setAgent(userUid, agentInterface, { currentCall: undefined });
      }
      this.recalcQueueStats(userUid, queueName);
    })();

    this.logger.debug(`AgentRingNoAnswer: ${agentInterface} on ${queueName}`);
  }

  /**
   * Handle QueueCallerAbandon ? caller gave up waiting.
   *
   * Persists a `cc_missed_calls` record so operators can call back later.
   * Multi-tenant: only logged when the queue resolves to a known tenant.
   * RINGING agents on this queue get missed_count (+ RONA when no missed_count rule).
   */
  handleCallerAbandon(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    // Snapshot RINGING agents before we mutate call/agent state
    const ringingAgents = this.stateService
      .getAllAgents(userUid)
      .filter((a) => a.status === 'RINGING' && a.queues.includes(queueName));

    // Pull caller info from in-memory state before removing
    const call = uniqueid ? this.stateService.getCall(uniqueid) : undefined;
    const callerIdNum = evt.calleridnum || call?.callerIdNum || '';
    const callerIdName = evt.calleridname || call?.callerIdName || '';
    const holdTime = parseInt(evt.holdtime, 10) || 0;
    const position = parseInt(evt.position, 10) || call?.position || 0;

    // Full history row (batched; does not replace cc_missed_calls callback workflow)
    if (uniqueid) {
      this.historyWriter.enqueue({
        call_uniqueid: uniqueid,
        queue_name: queueName,
        agent_interface: ringingAgents[0]?.interface || '',
        agent_user_uid: ringingAgents[0]?.userId || undefined,
        caller_id_num: callerIdNum,
        caller_id_name: callerIdName,
        enter_time: call?.enterTime,
        end_time: new Date(),
        wait_time: holdTime,
        hold_time: holdTime,
        disposition: 'abandoned',
        direction: 'inbound',
        position,
        user_uid: userUid,
      });
    }

    this.stateService.removeCall(uniqueid, 'abandoned');
    this.metricsService.recordAbandoned(userUid, queueName);
    this.publishQueueMetrics(userUid, queueName);
    this.stateService.emitEvent('callAbandon', userUid, {
      uniqueid,
      queue: queueName,
      callerIdNum,
      holdTime,
    });

    // Persist for missed-calls workflow (best-effort, doesn't block state)
    if (uniqueid && callerIdNum) {
      void this.persistMissedCall({
        uniqueid,
        queueName,
        callerIdNum,
        callerIdName,
        holdTime,
        position,
        userUid,
        personal: false,
      });
    }

    // D-15: agents who were ringing when the caller hung up.
    // missed_count always increments; RONA pauses at 1 only when no missed_count rule.
    // Keep RINGING until RONA finishes, then READY if still ringing (not PAUSED).
    for (const agent of ringingAgents) {
      this.stateService.setAgent(userUid, agent.interface, {
        callsMissed: (agent.callsMissed || 0) + 1,
      });
      this.metricsService.recordMissed(userUid, agent.interface, queueName);
      this.emitKpiUpdate(userUid, agent.interface, queueName);
      void this.autoPauseService.evaluateOnMissed(userUid, agent.interface, agent.queues);
    }
    void this.autoPauseService.evaluateRonaOnAbandon(userUid, queueName).finally(() => {
      for (const agent of ringingAgents) {
        const live = this.stateService.getAgent(userUid, agent.interface);
        if (live?.status === 'RINGING') {
          this.stateService.setAgent(userUid, agent.interface, {
            status: 'READY',
            currentCall: undefined,
          });
          this.metricsService.recordAgentStatus(userUid, agent.interface, 'READY');
        } else if (live?.currentCall) {
          this.stateService.setAgent(userUid, agent.interface, { currentCall: undefined });
        }
      }
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Insert one missed-call row per Asterisk uniqueid (idempotent).
   * Guards against duplicate AMI delivery (reconnect, multiple Nest processes).
   */
  private async persistMissedCall(params: {
    uniqueid: string;
    queueName: string;
    callerIdNum: string;
    callerIdName: string;
    holdTime: number;
    position: number;
    userUid: number;
    /** D-19: true for direct/internal misses on the operator, false for queue-abandoned. */
    personal: boolean;
  }): Promise<void> {
    const { uniqueid, queueName, callerIdNum, callerIdName, holdTime, position, userUid, personal } = params;
    if (this.loggedMissedUniqueids.has(uniqueid)) return;
    this.loggedMissedUniqueids.add(uniqueid);
    if (this.loggedMissedUniqueids.size > 2000) {
      const first = this.loggedMissedUniqueids.values().next().value;
      if (first) this.loggedMissedUniqueids.delete(first);
    }

    try {
      const [, created] = await this.missedCallModel.findOrCreate({
        where: { call_uniqueid: uniqueid },
        defaults: {
          call_uniqueid: uniqueid,
          queue_name: queueName,
          caller_id_num: callerIdNum,
          caller_id_name: callerIdName,
          hold_time: holdTime,
          position,
          called_back: false,
          personal,
          user_uid: userUid,
        },
      });
      if (!created) {
        this.logger.debug(`Missed call ${uniqueid} already logged ? skip duplicate`);
        return;
      }
      this.stateService.emitEvent('missedCallNew', userUid, {
        uniqueid,
        queue: queueName,
        callerIdNum,
        holdTime,
      });
    } catch (err: any) {
      // Unique-index race from another process
      if (err?.name === 'SequelizeUniqueConstraintError') {
        this.logger.debug(`Missed call ${uniqueid} race ? already inserted`);
        return;
      }
      this.logger.warn(`Persist missed call failed: ${err.message}`);
    }
  }

  /**
   * Handle QueueMemberAdded ? agent added to queue dynamically.
   */
  handleMemberAdded(evt: any): void {
    const queueName = evt.queue;
    const iface = evt.interface || evt.membername;
    if (!queueName || !iface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const agent = this.stateService.getAgent(userUid, iface);
    const queues = agent?.queues || [];
    if (!queues.includes(queueName)) queues.push(queueName);

    this.stateService.setAgent(userUid, iface, {
      queues,
      name: this.pickAgentDisplayName(iface, evt.membername, agent?.name),
      status: agent?.status || 'READY',
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle QueueMemberRemoved ? agent removed from queue.
   */
  handleMemberRemoved(evt: any): void {
    const queueName = evt.queue;
    const iface = evt.interface || evt.membername;
    if (!queueName || !iface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const agent = this.stateService.getAgent(userUid, iface);
    if (agent) {
      const queues = agent.queues.filter(q => q !== queueName);
      if (queues.length === 0) {
        this.stateService.removeAgent(userUid, iface);
      } else {
        this.stateService.setAgent(userUid, iface, { queues });
      }
    }

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AMI Hold event ? fired when a channel is placed on hold.
   * This happens when:
   * 1. SIP phone presses Hold button (SIP re-INVITE sendonly)
   * 2. Web UI triggers hold via AMI Redirect to MusicOnHold
   *
   * AMI Hold event fields:
   *   channel    = channel being held (agent channel)
   *   uniqueid   = uniqueid of the held channel
   *   musicclass = MOH class (default)
   */
  handleHold(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    // Find the active call where this channel is the agent or caller
    for (const call of this.iterateAllCalls()) {
      if (call.agentChannel === channel || call.callerChannel === channel) {
        this.stateService.setCall(call.uniqueid, { status: 'HOLD' });
        this.stateService.emitEvent('callHold', call.userUid, {
          uniqueid: call.uniqueid,
          channel,
          heldBy: call.agentChannel === channel ? 'agent' : 'caller',
        });
        this.logger.debug(`Hold: call ${call.uniqueid} held by ${channel}`);
        return;
      }
    }
  }

  /**
   * Handle AMI Unhold event ? fired when a hold is released.
   */
  handleUnhold(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    for (const call of this.iterateAllCalls()) {
      if ((call.agentChannel === channel || call.callerChannel === channel) && call.status === 'HOLD') {
        this.stateService.setCall(call.uniqueid, { status: 'TALKING' });
        this.stateService.emitEvent('callUnhold', call.userUid, {
          uniqueid: call.uniqueid,
          channel,
        });
        this.logger.debug(`Unhold: call ${call.uniqueid} resumed`);
        return;
      }
    }
  }

  /**
   * Get all active calls across all tenants.
   * Delegates to stateService.getAllCallsGlobal().
   */
  private iterateAllCalls() {
    return this.stateService.getAllCallsGlobal();
  }

  // --- All-channel agent AMI handlers (D-08) --------------
  // Unlike the queue-scoped handlers above, these resolve tenant/agent from
  // the AMI channel name via stateService.findAgentByChannel ? never from a
  // queue suffix (RESEARCH Pattern 2, Pitfall 1) ? so outbound/personal/
  // internal calls on an agent's own channel are tracked even outside a
  // queue context.

  /**
   * Handle DialBegin — a dial leg started on an agent's own channel (D-08/D-13).
   * Allowed from READY, PAUSED, and OUTBOUND_WORK so operators can dial out
   * while not taking queue inbound. Skips mid-call consult legs (IN_CALL).
   *
   * Critical: Channel = dialer, DestChannel = callee. Never treat a DialBegin
   * where we are DestChannel as our outbound (that is an inbound ring to us).
   * Also never reclaim personal RINGING → DIALING (inbound Newchannel).
   */
  handleDialBegin(evt: any): void {
    const channel = evt.channel || '';
    const destChannel = evt.destchannel || '';

    // Inbound leg: DestChannel is our softphone / SIP — seed personal RINGING for journal.
    if (destChannel) {
      const destAgent = this.stateService.findAgentByChannel(destChannel);
      if (destAgent) {
        this.seedPersonalInboundRing(destAgent, destChannel, {
          uniqueid: evt.destuniqueid || evt.uniqueid || destChannel,
          callerIdNum: String(evt.calleridnum || evt.connectedlinenum || '').trim(),
          callerIdName: String(evt.calleridname || evt.connectedlinename || '').trim(),
        });
      }
    }

    if (!channel) return;

    const agent = this.stateService.findAgentByChannel(channel);
    if (!agent) return;

    // We are the dial destination (someone is calling us) — not our outbound attempt.
    if (destChannel) {
      const destAgent = this.stateService.findAgentByChannel(destChannel);
      if (destAgent && destAgent.interface === agent.interface) {
        return;
      }
    }

    // Personal inbound (ring or answered) — never reclaim as outbound DialBegin.
    if (agent.status === 'RINGING' || (agent.status === 'IN_CALL' && !agent.currentCall)) {
      const pending = this.nonQueueCallStates.get(this.journalKey(agent.userUid, agent.interface));
      if (
        pending?.direction === 'personal'
        || this.personalRingingChannels.has(channel)
        || (agent.peerNumber && !agent.dialTarget)
      ) {
        return;
      }
    }

    // Device "In use" often arrives before DialBegin and maps to IN_CALL. Reclaim
    // that false early Talking when there is no queue-owned currentCall yet.
    // Consult/transfer legs (IN_CALL + currentCall) stay ignored.
    const canDial =
      agent.status === 'READY'
      || agent.status === 'PAUSED'
      || agent.status === 'OUTBOUND_WORK'
      || (agent.status === 'IN_CALL' && !agent.currentCall)
      || agent.status === 'DIALING';
    if (!canDial) return;

    // D-34/D-35: seed the non-queue call state so DialEnd/Hangup can persist
    // an all-direction cc_queue_calls history row for this attempt.
    const dialedNumber = this.extractDialedNumber(evt);
    // Never record "dialing ourselves" — usually a mis-parsed DialString on inbound.
    const agentExt = interfaceToExtension(agent.interface);
    if (dialedNumber && agentExt && dialedNumber === agentExt) {
      return;
    }

    const resumeStatus =
      agent.status === 'DIALING' || agent.status === 'IN_CALL'
        ? 'READY'
        : agent.status;
    this.stateService.setAgent(agent.userUid, agent.interface, {
      status: 'DIALING',
      dialTarget: dialedNumber || undefined,
      // Keep pause / outbound-work reason across the dial attempt
      pauseReason: agent.pauseReason,
    });
    this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'DIALING');
    void this.beginTimedStatus(agent, 'DIALING');

    this.nonQueueCallStates.set(this.journalKey(agent.userUid, agent.interface), {
      uniqueid: evt.uniqueid || channel,
      direction: dialedNumber && this.isInternalNumber(dialedNumber) ? 'internal' : 'outbound',
      callerIdNum: dialedNumber,
      callerIdName: evt.destcalleridname || '',
      enterTime: new Date(),
      resumeStatus,
    });
  }

  /**
   * Seed / keep personal inbound RINGING when AMI DialBegin DestChannel is us
   * (or Newchannel already started the ring). Ensures cc_queue_calls journal rows.
   */
  private seedPersonalInboundRing(
    agent: AgentState,
    channel: string,
    info: { uniqueid: string; callerIdNum: string; callerIdName: string },
  ): void {
    if (agent.currentCall) return;
    if (agent.status === 'DIALING' || agent.status === 'IN_CALL' || agent.status === 'CONSULT') return;
    if (agent.status !== 'READY' && agent.status !== 'RINGING') return;

    const agentExt = interfaceToExtension(agent.interface);
    if (info.callerIdNum && agentExt && info.callerIdNum === agentExt) return;

    this.personalRingingChannels.set(channel, {
      callerIdNum: info.callerIdNum,
      callerIdName: info.callerIdName,
    });
    this.nonQueueCallStates.set(this.journalKey(agent.userUid, agent.interface), {
      uniqueid: info.uniqueid,
      direction: 'personal',
      callerIdNum: info.callerIdNum,
      callerIdName: info.callerIdName,
      enterTime: new Date(),
    });
    if (agent.status === 'READY') {
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: 'RINGING',
        dialTarget: undefined,
        peerNumber: info.callerIdNum || undefined,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'RINGING');
    } else {
      this.stateService.setAgent(agent.userUid, agent.interface, {
        dialTarget: undefined,
        peerNumber: info.callerIdNum || agent.peerNumber || undefined,
      });
    }
  }

  /**
   * Handle DialEnd ? a dial leg on an agent's channel finished with a
   * DialStatus (D-08/D-11/D-12). ANSWER moves the agent to IN_CALL and
   * records a "made" call; anything else (BUSY/NOANSWER/CANCEL/
   * CONGESTION/CHANUNAVAIL) returns the agent to READY and records a
   * personal "missed" call. Never touches queue-driven transitions.
   */
  handleDialEnd(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    const agent = this.stateService.findAgentByChannel(channel);
    if (!agent) return;
    if (agent.status !== 'DIALING') return;

    void this.endTimedStatus(agent);
    const dialStatus = String(evt.dialstatus || '').toUpperCase();
    const key = this.journalKey(agent.userUid, agent.interface);
    const nonQueueState = this.nonQueueCallStates.get(key);

    if (dialStatus === 'ANSWER') {
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: 'IN_CALL',
        // Keep dialTarget until hangup so coworkers UI can show Outbound (number)
        callsMade: (agent.callsMade || 0) + 1,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'IN_CALL');
      this.metricsService.recordMade(agent.userUid, agent.interface);
      const inCallAgent = this.stateService.getAgent(agent.userUid, agent.interface);
      if (inCallAgent) {
        void this.beginTimedStatus(inCallAgent, 'CALL_START', '', {
          callUniqueid: nonQueueState?.uniqueid,
        });
      }
      // Kept open — handleAgentHangup writes the history row once the
      // (now-answered) call actually ends, so talk_time is accurate.
      if (nonQueueState) nonQueueState.answerTime = new Date();
    } else {
      const resume =
        nonQueueState?.resumeStatus === 'PAUSED'
        || nonQueueState?.resumeStatus === 'OUTBOUND_WORK'
          ? nonQueueState.resumeStatus
          : 'READY';
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: resume,
        dialTarget: undefined,
        peerNumber: '',
        pauseReason: resume === 'OUTBOUND_WORK'
          ? (agent.pauseReason || 'outbound_work')
          : resume === 'PAUSED'
            ? agent.pauseReason
            : '',
        callsMissed: (agent.callsMissed || 0) + 1,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, resume);
      this.metricsService.recordMissed(agent.userUid, agent.interface);
      void this.autoPauseService.evaluateOnMissed(agent.userUid, agent.interface, agent.queues);
      if (resume === 'PAUSED') {
        const paused = this.stateService.getAgent(agent.userUid, agent.interface);
        if (paused) void this.beginTimedStatus(paused, 'PAUSE', paused.pauseReason || '');
      }

      // D-34/D-35: the dial never connected — persist the history row now.
      this.nonQueueCallStates.delete(key);
      if (nonQueueState) {
        this.historyWriter.enqueue({
          call_uniqueid: nonQueueState.uniqueid,
          queue_name: `direct:${agent.interface}`,
          agent_interface: agent.interface,
          agent_user_uid: agent.userId,
          caller_id_num: nonQueueState.callerIdNum,
          caller_id_name: nonQueueState.callerIdName,
          enter_time: nonQueueState.enterTime,
          end_time: new Date(),
          wait_time: 0,
          talk_time: 0,
          disposition: dialStatus === 'NOANSWER' ? 'timeout' : dialStatus === 'CANCEL' ? 'abandoned' : 'other',
          position: 0,
          direction: nonQueueState.direction,
          call_type: dialStatus.toLowerCase() || 'unknown',
          user_uid: agent.userUid,
        });
      }
    }
    this.emitKpiUpdate(agent.userUid, agent.interface);
  }

  /**
   * Handle Newchannel ? used only to detect a personal/direct inbound ring
   * on an agent's own channel (D-08). Queue-driven ringing is already
   * reported via QueueMemberStatus (status code 6 > handleAgentStatusEvent)
   * so this must stay conservative to avoid double-counting: it only acts
   * when the agent is READY and AMI already reports a ringing channel state
   * (field casing/values to be confirmed against a live Asterisk ? see
   * 09-RESEARCH "Manual-Only" verification note).
   */
  handleNewchannel(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    const agent = this.stateService.findAgentByChannel(channel);
    if (!agent) return;
    if (agent.status !== 'READY') return;

    const stateDesc = String(evt.channelstatedesc || '').toLowerCase();
    const isRinging = stateDesc.includes('ring') || evt.channelstate === '4' || evt.channelstate === '5';
    if (!isRinging) return;

    // Softphone/PJSIP outbound: Newchannel often arrives with Ring + CallerID = the
    // agent's own extension before DialBegin. That is not a personal inbound ring —
    // treating it as one stores the softphone number in the journal and blocks DialBegin.
    const callerIdNum = String(evt.calleridnum || '').trim();
    const agentExt = interfaceToExtension(agent.interface);
    if (callerIdNum && agentExt && callerIdNum === agentExt) {
      return;
    }

    this.seedPersonalInboundRing(agent, channel, {
      uniqueid: evt.uniqueid || channel,
      callerIdNum,
      callerIdName: String(evt.calleridname || '').trim(),
    });
  }

  /**
   * Handle Hangup on an agent's own channel ? releases DIALING / a personal
   * direct ring / a personal (non-queue) call that AgentComplete never sees
   * because it wasn't answered through a queue (D-08). Queue-driven hangups
   * continue to be resolved exclusively via AgentComplete; this only acts
   * when the agent's own channel is the one hanging up.
   */
  handleAgentHangup(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    const personalRing = this.personalRingingChannels.get(channel);
    this.personalRingingChannels.delete(channel);

    const agent = this.stateService.findAgentByChannel(channel);
    if (!agent) return;

    const key = this.journalKey(agent.userUid, agent.interface);
    const nonQueueState = this.nonQueueCallStates.get(key);

    if (agent.status === 'DIALING') {
      void this.endTimedStatus(agent);
      const resume =
        nonQueueState?.resumeStatus === 'PAUSED'
        || nonQueueState?.resumeStatus === 'OUTBOUND_WORK'
          ? nonQueueState.resumeStatus
          : 'READY';
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: resume,
        dialTarget: undefined,
        peerNumber: '',
        pauseReason: resume === 'OUTBOUND_WORK'
          ? (agent.pauseReason || 'outbound_work')
          : resume === 'PAUSED'
            ? agent.pauseReason
            : '',
        callsMissed: (agent.callsMissed || 0) + 1,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, resume);
      this.metricsService.recordMissed(agent.userUid, agent.interface);
      void this.autoPauseService.evaluateOnMissed(agent.userUid, agent.interface, agent.queues);
      if (resume === 'PAUSED') {
        const paused = this.stateService.getAgent(agent.userUid, agent.interface);
        if (paused) void this.beginTimedStatus(paused, 'PAUSE', paused.pauseReason || '');
      }

      // D-34/D-35: agent hung up before DialEnd fired — the attempt was cancelled.
      this.nonQueueCallStates.delete(key);
      if (nonQueueState) {
        this.historyWriter.enqueue({
          call_uniqueid: nonQueueState.uniqueid,
          queue_name: `direct:${agent.interface}`,
          agent_interface: agent.interface,
          agent_user_uid: agent.userId,
          caller_id_num: nonQueueState.callerIdNum,
          caller_id_name: nonQueueState.callerIdName,
          enter_time: nonQueueState.enterTime,
          end_time: new Date(),
          wait_time: 0,
          talk_time: 0,
          disposition: 'abandoned',
          position: 0,
          direction: nonQueueState.direction,
          call_type: 'cancel',
          user_uid: agent.userUid,
        });
      }
      this.emitKpiUpdate(agent.userUid, agent.interface);
      return;
    }

    if (agent.status === 'RINGING' && personalRing) {
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: 'READY',
        callsMissed: (agent.callsMissed || 0) + 1,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'READY');
      this.metricsService.recordMissed(agent.userUid, agent.interface);
      void this.autoPauseService.evaluateOnMissed(agent.userUid, agent.interface, agent.queues);
      // D-19 personal miss: queue_name is NOT NULL, so encode ownership as
      // direct:<agentInterface> rather than persisting an empty queue. Skips
      // silently when the caller id is unknown — in-queue RNA never reaches
      // this handler, but a genuinely anonymous direct ring is not worklist-
      // actionable either (D-10/D-20).
      const callerIdNum = personalRing.callerIdNum || evt.calleridnum || '';
      if (callerIdNum) {
        void this.persistMissedCall({
          uniqueid: evt.uniqueid || channel,
          queueName: `direct:${agent.interface}`,
          callerIdNum,
          callerIdName: personalRing.callerIdName || evt.calleridname || '',
          holdTime: 0,
          position: 0,
          userUid: agent.userUid,
          personal: true,
        });
      }

      // D-34/D-35: same missed direct ring, now as an all-direction history row.
      this.nonQueueCallStates.delete(key);
      if (nonQueueState) {
        this.historyWriter.enqueue({
          call_uniqueid: nonQueueState.uniqueid,
          queue_name: `direct:${agent.interface}`,
          agent_interface: agent.interface,
          agent_user_uid: agent.userId,
          caller_id_num: nonQueueState.callerIdNum,
          caller_id_name: nonQueueState.callerIdName,
          enter_time: nonQueueState.enterTime,
          end_time: new Date(),
          wait_time: 0,
          talk_time: 0,
          disposition: 'abandoned',
          position: 0,
          direction: 'personal',
          call_type: 'ring',
          user_uid: agent.userUid,
        });
      }
      this.emitKpiUpdate(agent.userUid, agent.interface);
      return;
    }

    // Personal call ending outside a queue context: agent is IN_CALL but has
    // no queue-tracked currentCall (queue calls are released by AgentComplete,
    // never by this handler ? avoids double-processing the same hangup).
    if (agent.status === 'IN_CALL' && !agent.currentCall) {
      const answered = Boolean(nonQueueState?.answerTime);
      const isOutbound =
        nonQueueState?.direction === 'outbound'
        || nonQueueState?.direction === 'internal';
      void this.endTimedStatus(agent).then((journalSec) => {
        if (answered) {
          const answerTime = nonQueueState?.answerTime || nonQueueState?.enterTime;
          const talkSec = answerTime
            ? Math.max(0, Math.round((Date.now() - answerTime.getTime()) / 1000))
            : journalSec;
          if (talkSec > 0) {
            void this.incrementSessionTotals(agent.userId, agent.interface, {
              total_talk_time: talkSec,
              total_calls: 1,
            });
          }
        }
      });
      // Outbound already counted in callsMade at DialEnd ANSWER — only bump
      // callsTaken for personal inbound answers (aligns with status-bar KPI).
      const resume =
        isOutbound
        && (nonQueueState?.resumeStatus === 'PAUSED'
          || nonQueueState?.resumeStatus === 'OUTBOUND_WORK')
          ? nonQueueState!.resumeStatus!
          : 'READY';
      this.stateService.setAgent(agent.userUid, agent.interface, {
        status: resume,
        dialTarget: undefined,
        peerNumber: '',
        pauseReason: resume === 'OUTBOUND_WORK'
          ? (agent.pauseReason || 'outbound_work')
          : resume === 'PAUSED'
            ? agent.pauseReason
            : '',
        callsTaken:
          answered && !isOutbound
            ? (agent.callsTaken || 0) + 1
            : (agent.callsTaken || 0),
        lastCallTime: answered ? new Date() : agent.lastCallTime,
      });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, resume);
      if (answered && !isOutbound) {
        this.metricsService.recordAnsweredDirect(agent.userUid, agent.interface);
        this.emitKpiUpdate(agent.userUid, agent.interface);
      }
      if (answered) void this.logAgentEventForAgent(agent, 'CALL_END');
      if (resume === 'PAUSED') {
        const paused = this.stateService.getAgent(agent.userUid, agent.interface);
        if (paused) void this.beginTimedStatus(paused, 'PAUSE', paused.pauseReason || '');
      }

      // D-34/D-35: the outbound/personal call connected and has now ended.
      // Answer time is precise for outbound (set at DialEnd ANSWER); for a
      // personal direct ring there is no distinct "answered" AMI event in
      // this listener set, so it is approximated as ring-start ([ASSUMED],
      // slightly overestimates talk_time by the ring duration — flagged for
      // 09-VALIDATION).
      this.nonQueueCallStates.delete(key);
      if (nonQueueState) {
        const answerTime = nonQueueState.answerTime || nonQueueState.enterTime;
        const talkSec = Math.max(0, Math.round((Date.now() - answerTime.getTime()) / 1000));
        this.historyWriter.enqueue({
          call_uniqueid: nonQueueState.uniqueid,
          queue_name: `direct:${agent.interface}`,
          agent_interface: agent.interface,
          agent_user_uid: agent.userId,
          caller_id_num: nonQueueState.callerIdNum,
          caller_id_name: nonQueueState.callerIdName,
          enter_time: nonQueueState.enterTime,
          answer_time: answerTime,
          end_time: new Date(),
          wait_time: 0,
          talk_time: talkSec,
          disposition: 'answered',
          position: 0,
          direction: nonQueueState.direction,
          call_type: nonQueueState.direction === 'personal' ? 'ring' : 'dial',
          user_uid: agent.userUid,
        });
      }
    }
  }

  /**
   * Resolve a queue-member AMI interface to the logged-in agent row
   * (WebRTC ↔ primary twin), matching QueueMemberStatus.
   */
  private resolveMemberAgent(userUid: number, iface: string | undefined): AgentState | undefined {
    if (!iface) return undefined;
    const viaChannel = this.stateService.findAgentByChannel(iface);
    if (viaChannel && viaChannel.userUid === userUid && viaChannel.userId > 0) {
      return viaChannel;
    }
    return this.stateService.getAgent(userUid, iface);
  }

  /**
   * Drop a phantom outbound/personal dial attempt (no live softphone/AMI call).
   * Used on pause / unpause / auto-pause so a stale nonQueueCallStates entry
   * cannot resurrect DIALING after Resume.
   */
  clearNonQueueDialAttempt(userUid: number, agentInterface: string): void {
    if (!agentInterface) return;
    const key = this.journalKey(userUid, agentInterface);
    this.nonQueueCallStates.delete(key);
    for (const [channel, _meta] of [...this.personalRingingChannels.entries()]) {
      const owner = this.stateService.findAgentByChannel(channel);
      if (owner && owner.userUid === userUid && owner.interface === agentInterface) {
        this.personalRingingChannels.delete(channel);
      }
    }
  }

  /**
   * Emit an agentKpiUpdate SSE delta with only the changed agent's counters
   * (D-45). Includes per-queue counters too when a queue context is known.
   */
  private emitKpiUpdate(userUid: number, agentInterface: string, queueName?: string): void {
    if (!agentInterface) return;
    const payload: any = {
      agent: agentInterface,
      kpi: this.metricsService.getAgentKpi(userUid, agentInterface),
    };
    if (queueName) {
      payload.queue = queueName;
      payload.queueKpi = this.metricsService.getAgentQueueKpi(userUid, agentInterface, queueName);
    }
    this.stateService.emitEvent('agentKpiUpdate', userUid, payload);
  }

  // ??? Helpers ?????????????????????????????????????????????

  /**
   * Map Asterisk device status code to our AgentStatus.
   * Asterisk QueueMemberStatus values:
   *   0 = Unknown, 1 = Not in use, 2 = In use, 3 = Busy, 4 = Invalid,
   *   5 = Unavailable, 6 = Ringing, 7 = Ring+Inuse, 8 = On Hold
   */
  private mapAsteriskStatus(statusCode: string, paused?: string): AgentStatus {
    if (paused === '1') return 'PAUSED';

    switch (String(statusCode)) {
      case '1': return 'READY';       // Not in use
      case '2': return 'IN_CALL';     // In use
      case '3': return 'IN_CALL';     // Busy
      case '0':
      case '4': return 'OFFLINE';     // Unknown / Invalid (device cannot take calls)
      case '5': return 'OFFLINE';     // Unavailable
      case '6': return 'RINGING';     // Ringing
      case '7': return 'IN_CALL';     // Ring+Inuse
      case '8': return 'IN_CALL';     // On Hold (we track hold separately)
      default:  return 'READY';
    }
  }

  /**
   * Tenant from queue name suffix (`q700_0` > 0, `sales_7` > 7).
   * IMPORTANT: 0 is a valid tenant ? never treat it as falsy.
   */
  private resolveQueueTenant(queueName: string): number | null {
    return CallCenterAmiService.parseQueueTenant(queueName);
  }

  /** Public helper for agentLogin / SSE tenant alignment. */
  static parseQueueTenant(queueName: string): number | null {
    const match = queueName.match(/_(\d+)$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  /**
   * Destination number for DialBegin history / dialTarget.
   * Softphone dials often put the peer in DialString as PJSIP/e201_0/... rather
   * than DestCallerIDNum — unwrap tech prefix and e{ext}_{tenant} ids.
   */
  private extractDialedNumber(evt: any): string {
    const raw = String(
      evt.destcalleridnum || evt.destexten || evt.exten || evt.dialstring || '',
    ).trim();
    if (!raw) return '';
    let s = raw.replace(/^(PJSIP|SIP)\//i, '').split('@')[0].split('/')[0].trim();
    const sipId = s.match(/^ew?(.+)_\d+$/i);
    if (sipId) return sipId[1];
    return s;
  }

  /**
   * [ASSUMED] Heuristic for D-34/D-35 direction classification: a short
   * all-digit destination (no leading '+', no separators) looks like an
   * internal extension rather than an external PSTN number, so DialBegin
   * can tag the attempt 'internal' instead of 'outbound'. Verify against
   * real extension lengths on a live tenant (09-VALIDATION).
   */
  private isInternalNumber(num: string): boolean {
    return /^\d{1,5}$/.test(num);
  }

  /** True when AMI gave us a raw interface / extension instead of a person name. */
  private isRawAgentName(iface: string, name?: string): boolean {
    if (!name) return true;
    if (name === iface) return true;
    if (/^(PJSIP|SIP)\//i.test(name)) return true;
    // Originate CallerID uses the short extension — QueueMember then echoes it as
    // membername; that must not replace the operator's real display name.
    const ext = interfaceToExtension(iface);
    if (ext && name === ext) return true;
    if (/^e(w)?.+_\d+$/i.test(name)) return true;
    return false;
  }

  /**
   * Keep a human display name from agentLogin; never let AMI overwrite it
   * with PJSIP/? membername.
   */
  private pickAgentDisplayName(
    iface: string,
    candidate: string | undefined,
    existing?: string,
  ): string {
    if (existing && !this.isRawAgentName(iface, existing)) return existing;
    if (candidate && !this.isRawAgentName(iface, candidate)) return candidate;
    return existing || candidate || iface;
  }

  /**
   * Resolve the caller's uniqueid for AgentConnect / AgentComplete / Leave.
   * Prefer destuniqueid (caller). Never key state by the agent channel uniqueid
   * alone ? that orphans the QueueCallerJoin WAITING row.
   */
  private resolveCallerCallKey(evt: any, userUid: number): string | null {
    const destUid = evt.destuniqueid || '';
    const uid = evt.uniqueid || '';
    const destChannel = evt.destchannel || '';
    const channel = evt.channel || '';
    const queue = evt.queue || '';

    if (destUid && this.stateService.getCall(destUid)) return destUid;
    if (uid && this.stateService.getCall(uid)) return uid;

    const channelCandidates = [destChannel, channel].filter(Boolean);
    if (channelCandidates.length) {
      const byChannel = this.stateService.getAllCalls(userUid).find(
        (c) =>
          (c.callerChannel && channelCandidates.includes(c.callerChannel))
          || (c.agentChannel && channelCandidates.includes(c.agentChannel)),
      );
      if (byChannel) return byChannel.uniqueid;
    }

    if (queue) {
      const inQueue = this.stateService
        .getAllCalls(userUid)
        .filter((c) => c.queue === queue);
      const onlyWaiting = inQueue.filter(
        (c) => c.status === 'WAITING' || c.status === 'RINGING',
      );
      if (onlyWaiting.length === 1) return onlyWaiting[0].uniqueid;

      const byAgent = evt.interface || evt.membername;
      if (byAgent) {
        const linked = inQueue.find(
          (c) =>
            c.agent === byAgent
            && (c.status === 'TALKING' || c.status === 'HOLD'),
        );
        if (linked) return linked.uniqueid;
      }
    }

    // Prefer caller destuniqueid; never invent a key from agent-only uniqueid
    return destUid || null;
  }

  /**
   * Publish computed queue metrics to SSE and sync SLA into QueueState.
   */
  private publishQueueMetrics(userUid: number, queueName: string): void {
    const metrics = this.metricsService.getQueueMetrics(userUid, queueName);
    this.stateService.emitEvent('queueMetrics', userUid, {
      queue: queueName,
      metrics,
    });
    this.stateService.setQueue(userUid, queueName, {
      sla: metrics.sla,
      avgWait: metrics.asa,
      avgTalk: metrics.aht,
      calls: {
        answered: metrics.answered,
        abandoned: metrics.abandoned,
        total: metrics.offered,
      },
    });
  }

  /**
   * Recalculate queue aggregate stats from current state.
   */
  private recalcQueueStats(userUid: number, queueName: string): void {
    const allCalls = this.stateService.getAllCalls(userUid);
    const queueCalls = allCalls.filter(c => c.queue === queueName);
    const waiting = queueCalls.filter(c => c.status === 'WAITING' || c.status === 'RINGING').length;
    const talking = queueCalls.filter(c => c.status === 'TALKING' || c.status === 'HOLD').length;

    this.stateService.setQueue(userUid, queueName, { waiting, talking });
    // Agent free/paused/busy counts are maintained by CallCenterStateService.setAgent
    this.stateService.recomputeQueueAgentStats(userUid, queueName);
  }

  /**
   * Find the currently-open session for an agent so AMI-driven journal
   * writes (D-09/D-13) can populate session_id/user_id exactly like the
   * existing LOGIN/LOGOUT/PAUSE/etc. rows written from CallCenterService.
   * AMI handlers only have the in-memory AgentState, not CallCenterService's
   * activeSessions map, so this looks the session up by (user_id,
   * agent_interface, logout_time IS NULL) ? the same tuple agentLogin() uses
   * to create it.
   */
  private async findActiveSessionId(userId: number, agentInterface: string): Promise<number | null> {
    if (!userId || userId <= 0) return null;
    try {
      const session = await this.agentSessionModel.findOne({
        where: { user_id: userId, agent_interface: agentInterface, logout_time: null },
        order: [['login_time', 'DESC']],
      });
      return session ? (session.getDataValue('uid') as number) : null;
    } catch (err: any) {
      this.logger.warn(`findActiveSessionId failed: ${err.message}`);
      return null;
    }
  }

  private journalKey(userUid: number, agentInterface: string): string {
    return `${userUid}:${agentInterface}`;
  }

  /**
   * Begin a timed status journal row (PAUSE / CALL_START / WRAPUP_START /
   * DIALING / CONSULT / ACW). Closes any previous open row for this agent first
   * so durations stay accurate for pause-report and session totals.
   */
  async beginTimedStatus(
    agent: AgentState,
    eventType: (typeof CallCenterAmiService.TIMED_STATUS_EVENTS)[number],
    reason = '',
    extra?: { callUniqueid?: string; queueName?: string; callerId?: string },
  ): Promise<void> {
    await this.endTimedStatus(agent);
    const sessionId = await this.findActiveSessionId(agent.userId, agent.interface);
    if (!sessionId) return;
    try {
      const row = await this.agentEventModel.create({
        session_id: sessionId,
        user_id: agent.userId,
        event_type: eventType,
        reason: reason || '',
        call_uniqueid: extra?.callUniqueid || '',
        caller_id: extra?.callerId || '',
        queue_name: extra?.queueName || '',
        duration: 0,
        user_uid: agent.userUid,
      } as any);
      this.statusJournalEntries.set(this.journalKey(agent.userUid, agent.interface), {
        uid: row.getDataValue('uid') as number,
        enteredAt: Date.now(),
        eventType,
        sessionId,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log ${eventType} journal entry: ${err.message}`);
    }
  }

  /**
   * Close the open timed journal row: fill duration and bump session
   * total_pause_time when leaving PAUSE. Returns duration seconds (0 if none).
   * Falls back to the latest duration=0 timed event in DB (auto-pause path).
   */
  async endTimedStatus(agent: AgentState): Promise<number> {
    const key = this.journalKey(agent.userUid, agent.interface);
    const entry = this.statusJournalEntries.get(key);
    if (entry) {
      this.statusJournalEntries.delete(key);
      const durationSec = Math.max(0, Math.round((Date.now() - entry.enteredAt) / 1000));
      try {
        await this.agentEventModel.update({ duration: durationSec }, { where: { uid: entry.uid } });
        if (entry.eventType === 'PAUSE' && durationSec > 0) {
          await this.agentSessionModel.increment(
            { total_pause_time: durationSec },
            { where: { uid: entry.sessionId } },
          );
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fill journal exit duration: ${err.message}`);
      }
      return durationSec;
    }

    // DB fallback — e.g. auto-pause wrote PAUSE without AMI in-memory tracking
    const sessionId = await this.findActiveSessionId(agent.userId, agent.interface);
    if (!sessionId) return 0;
    try {
      const open = await this.agentEventModel.findOne({
        where: {
          session_id: sessionId,
          event_type: [...CallCenterAmiService.TIMED_STATUS_EVENTS],
          duration: 0,
        },
        order: [['created_at', 'DESC']],
      });
      if (!open) return 0;
      const createdAt = open.getDataValue('created_at') as Date;
      const durationSec = Math.max(
        0,
        Math.round((Date.now() - new Date(createdAt).getTime()) / 1000),
      );
      await open.update({ duration: durationSec });
      const eventType = open.getDataValue('event_type') as string;
      if (eventType === 'PAUSE' && durationSec > 0) {
        await this.agentSessionModel.increment(
          { total_pause_time: durationSec },
          { where: { uid: sessionId } },
        );
      }
      return durationSec;
    } catch (err: any) {
      this.logger.warn(`Failed to close open timed event: ${err.message}`);
      return 0;
    }
  }

  /** Point-in-time event for an agent (READY / WRAPUP_END / CALL_END / …). */
  async logAgentEventForAgent(
    agent: AgentState,
    eventType: string,
    reason = '',
  ): Promise<void> {
    const sessionId = await this.findActiveSessionId(agent.userId, agent.interface);
    if (!sessionId) return;
    await this.logAgentEvent({
      sessionId,
      userId: agent.userId,
      eventType,
      reason,
      userUid: agent.userUid,
    });
  }

  /** Atomically bump session counter columns (talk / calls / idle). */
  async incrementSessionTotals(
    userId: number,
    agentInterface: string,
    deltas: Partial<{
      total_talk_time: number;
      total_calls: number;
      total_idle_time: number;
      total_pause_time: number;
    }>,
  ): Promise<void> {
    const sessionId = await this.findActiveSessionId(userId, agentInterface);
    if (!sessionId) return;
    const patch: Record<string, number> = {};
    for (const [k, v] of Object.entries(deltas)) {
      if (typeof v === 'number' && v !== 0) patch[k] = v;
    }
    if (!Object.keys(patch).length) return;
    try {
      await this.agentSessionModel.increment(patch, { where: { uid: sessionId } });
    } catch (err: any) {
      this.logger.warn(`Failed to increment session totals: ${err.message}`);
    }
  }

  /**
   * Log an agent event to the database for historical reporting/timeline.
   */
  async logAgentEvent(params: {
    sessionId: number;
    userId: number;
    eventType: string;
    reason?: string;
    callUniqueid?: string;
    callerId?: string;
    queueName?: string;
    duration?: number;
    userUid: number;
  }): Promise<void> {
    try {
      await this.agentEventModel.create({
        session_id: params.sessionId,
        user_id: params.userId,
        event_type: params.eventType,
        reason: params.reason || '',
        call_uniqueid: params.callUniqueid || '',
        caller_id: params.callerId || '',
        queue_name: params.queueName || '',
        duration: params.duration || 0,
        user_uid: params.userUid,
      });
    } catch (err: any) {
      this.logger.error(`Failed to log agent event: ${err.message}`);
    }
  }
}
