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
  }>();

  /** Warn only once if CallCenterService isn't resolvable via ModuleRef. */
  private warnedMissingCcService = false;

  /**
   * Open DIALING/CONSULT/ACW journal rows awaiting their exit timestamp
   * (D-09/D-13). Key = `${userUid}:${agentInterface}`.
   */
  private readonly statusJournalEntries = new Map<string, { uid: number; enteredAt: number }>();

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
        sla: parseFloat(qp.servicelevel) || 0,
        calls: {
          answered: parseInt(qp.completed, 10) || 0,
          abandoned: parseInt(qp.abandoned, 10) || 0,
          total: (parseInt(qp.completed, 10) || 0) + (parseInt(qp.abandoned, 10) || 0),
        },
        avgWait: parseInt(qp.holdtime, 10) || 0,
        avgTalk: parseInt(qp.talktime, 10) || 0,
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

    this.logger.log(
      `? Initial state loaded: ${queueParams.length} queues, ${members.length} members, ${entries.length} waiting calls`,
    );
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

    const existing = this.stateService.getAgent(userUid, iface);
    const paused = evt.paused === '1' || evt.paused === 1 || evt.paused === true;
    let status = this.mapAsteriskStatus(evt.status, evt.paused);
    // Logged-in operator: temporary SIP/WebRTC Unavailable must not end the shift.
    // Browser tab throttle often drops WSS > Asterisk status 5 > would show "Start shift".
    if (status === 'OFFLINE' && existing?.userId) {
      if (paused || existing.status === 'PAUSED') {
        status = 'PAUSED';
      } else if (
        existing.status === 'IN_CALL'
        || existing.status === 'RINGING'
        || existing.status === 'WRAPUP'
      ) {
        status = existing.status;
      } else {
        status = 'READY';
      }
    }
    // Asterisk QueueMemberPause / QueueMember use PausedReason > pausedreason
    const amiReason = (evt.pausedreason || evt.reason || '').trim();
    let pauseReason: string | undefined;
    if (paused || status === 'PAUSED') {
      pauseReason = amiReason || existing?.pauseReason || undefined;
    } else {
      pauseReason = ''; // clear for SSE (setAgent > pauseReason: null)
    }

    const updated = this.stateService.setAgent(userUid, iface, {
      status,
      pauseReason,
      // Session counter (agentLogin resets to 0); do not import Asterisk lifetime CallsTaken
      callsTaken:
        existing?.userId != null && existing.userId > 0
          ? (existing.callsTaken ?? 0)
          : (parseInt(evt.callstaken, 10) || existing?.callsTaken || 0),
      name: this.pickAgentDisplayName(iface, evt.membername, existing?.name),
    });

    this.metricsService.recordAgentStatus(userUid, iface, status);
    void this.autoPauseService.evaluateOnStatusEvent(userUid, iface, status, updated.queues, updated.lastCallTime);
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
   * Handle QueueCallerLeave ? caller left the queue without AgentComplete
   * (timeout, redirect, abandon race). Clears orphan WAITING rows.
   */
  handleCallerLeave(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const key = this.resolveCallerCallKey(evt, userUid);
    if (key) {
      this.stateService.removeCall(key, 'left');
    } else if (uniqueid) {
      this.stateService.removeCall(uniqueid, 'left');
    }

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AgentConnect ? an agent answered a queued call.
   */
  handleAgentConnect(evt: any): void {
    const queueName = evt.queue;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

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

    this.stateService.setCall(uniqueid, {
      agent: agentInterface,
      agentChannel,
      callerChannel: callerChannel || undefined,
      status: 'TALKING',
      answerTime: new Date(),
      userUid,
      queue: queueName,
    });

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'IN_CALL',
      currentCall: uniqueid,
    });

    this.metricsService.recordAgentStatus(userUid, agentInterface, 'IN_CALL');

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
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AgentComplete ? call finished (agent or caller hung up).
   */
  handleAgentComplete(evt: any): void {
    const queueName = evt.queue;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

    const agent = agentInterface
      ? this.stateService.getAgent(userUid, agentInterface)
      : undefined;
    const uniqueid =
      this.resolveCallerCallKey(evt, userUid)
      || agent?.currentCall
      || evt.destuniqueid
      || evt.uniqueid
      || undefined;

    // Snapshot call before remove ? needed for history row (batched writer, D-09)
    const call = uniqueid ? this.stateService.getCall(uniqueid) : undefined;

    if (uniqueid) {
      const enterTime = call?.enterTime;
      const answerTime = call?.answerTime;
      const endTime = new Date();
      const waitSec =
        enterTime && answerTime
          ? Math.max(0, Math.round((answerTime.getTime() - enterTime.getTime()) / 1000))
          : (parseInt(evt.holdtime, 10) || 0);
      const talkSec =
        answerTime
          ? Math.max(0, Math.round((endTime.getTime() - answerTime.getTime()) / 1000))
          : (parseInt(evt.talktime, 10) || call?.talkTime || 0);
      const wrapupSec = agent?.wrapupTimeout || 0;

      this.metricsService.recordAnswered(
        userUid,
        queueName,
        agentInterface || call?.agent || '',
        waitSec,
        talkSec,
        wrapupSec,
      );
      this.emitKpiUpdate(userUid, agentInterface || call?.agent || '', queueName);
      this.publishQueueMetrics(userUid, queueName);

      this.historyWriter.enqueue({
        call_uniqueid: uniqueid,
        queue_name: queueName,
        agent_interface: agentInterface || call?.agent || '',
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

    // Agent transitions to WRAPUP (if wrapuptime > 0) or READY
    const agentAfter = this.stateService.getAgent(userUid, agentInterface);
    if (agentAfter) {
      const wrapupTime = agentAfter.wrapupTimeout || 0;
      if (wrapupTime > 0) {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'WRAPUP',
          currentCall: undefined,
          callsTaken: (agentAfter.callsTaken || 0) + 1,
          lastCallTime: new Date(),
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'WRAPUP');
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
            this.stateService.setAgent(userUid, agentInterface, { status: 'READY' });
            this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
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
          callsTaken: (agentAfter.callsTaken || 0) + 1,
          lastCallTime: new Date(),
        });
        this.metricsService.recordAgentStatus(userUid, agentInterface, 'READY');
      }
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
   * Handle QueueCallerAbandon ? caller gave up waiting.
   *
   * Persists a `cc_missed_calls` record so operators can call back later.
   * Multi-tenant: only logged when the queue resolves to a known tenant.
   */
  handleCallerAbandon(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (userUid == null) return;

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
        agent_interface: '',
        caller_id_num: callerIdNum,
        caller_id_name: callerIdName,
        enter_time: call?.enterTime,
        end_time: new Date(),
        wait_time: holdTime,
        hold_time: holdTime,
        disposition: 'abandoned',
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

    // D-15 RONA: agents still RINGING in this queue when the caller gave up
    // did not answer in time — auto-pause them (fixed, always-on trigger).
    void this.autoPauseService.evaluateRonaOnAbandon(userUid, queueName);

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
   * Handle DialBegin ? a dial leg started on an agent's own channel (D-08/D-13).
   * Only sets DIALING when the agent is currently READY ? this guards against
   * misinterpreting a consult/transfer leg dialed mid-call as a fresh
   * outbound attempt (RESEARCH Pitfall 1/6).
   */
  handleDialBegin(evt: any): void {
    const channel = evt.channel || '';
    if (!channel) return;

    const agent = this.stateService.findAgentByChannel(channel);
    if (!agent) return;
    if (agent.status !== 'READY') return;

    this.stateService.setAgent(agent.userUid, agent.interface, { status: 'DIALING' });
    this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'DIALING');
    void this.logStatusJournalEnter(agent, 'DIALING');

    // D-34/D-35: seed the non-queue call state so DialEnd/Hangup can persist
    // an all-direction cc_queue_calls history row for this attempt.
    const dialedNumber = evt.destcalleridnum || evt.exten || '';
    this.nonQueueCallStates.set(this.journalKey(agent.userUid, agent.interface), {
      uniqueid: evt.uniqueid || channel,
      direction: dialedNumber && this.isInternalNumber(dialedNumber) ? 'internal' : 'outbound',
      callerIdNum: dialedNumber,
      callerIdName: evt.destcalleridname || '',
      enterTime: new Date(),
    });
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

    void this.logStatusJournalExit(agent);
    const dialStatus = String(evt.dialstatus || '').toUpperCase();
    const key = this.journalKey(agent.userUid, agent.interface);
    const nonQueueState = this.nonQueueCallStates.get(key);

    if (dialStatus === 'ANSWER') {
      this.stateService.setAgent(agent.userUid, agent.interface, { status: 'IN_CALL' });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'IN_CALL');
      this.metricsService.recordMade(agent.userUid, agent.interface);
      // Kept open — handleAgentHangup writes the history row once the
      // (now-answered) call actually ends, so talk_time is accurate.
      if (nonQueueState) nonQueueState.answerTime = new Date();
    } else {
      this.stateService.setAgent(agent.userUid, agent.interface, { status: 'READY' });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'READY');
      this.metricsService.recordMissed(agent.userUid, agent.interface);
      void this.autoPauseService.evaluateOnMissed(agent.userUid, agent.interface, agent.queues);

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

    this.personalRingingChannels.set(channel, {
      callerIdNum: evt.calleridnum || '',
      callerIdName: evt.calleridname || '',
    });
    // D-34/D-35: seed the non-queue call state for a personal direct ring —
    // handleAgentHangup persists the history row (missed or answered).
    this.nonQueueCallStates.set(this.journalKey(agent.userUid, agent.interface), {
      uniqueid: evt.uniqueid || channel,
      direction: 'personal',
      callerIdNum: evt.calleridnum || '',
      callerIdName: evt.calleridname || '',
      enterTime: new Date(),
    });
    this.stateService.setAgent(agent.userUid, agent.interface, { status: 'RINGING' });
    this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'RINGING');
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
      void this.logStatusJournalExit(agent);
      this.stateService.setAgent(agent.userUid, agent.interface, { status: 'READY' });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'READY');
      this.metricsService.recordMissed(agent.userUid, agent.interface);
      void this.autoPauseService.evaluateOnMissed(agent.userUid, agent.interface, agent.queues);

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
      this.stateService.setAgent(agent.userUid, agent.interface, { status: 'READY' });
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
      this.stateService.setAgent(agent.userUid, agent.interface, { status: 'READY' });
      this.metricsService.recordAgentStatus(agent.userUid, agent.interface, 'READY');

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
   *   1 = Not in use (idle), 2 = In use, 3 = Busy, 5 = Unavailable,
   *   6 = Ringing, 7 = Ring+Inuse, 8 = On Hold
   */
  private mapAsteriskStatus(statusCode: string, paused?: string): AgentStatus {
    if (paused === '1') return 'PAUSED';

    switch (statusCode) {
      case '1': return 'READY';       // Not in use
      case '2': return 'IN_CALL';     // In use
      case '3': return 'IN_CALL';     // Busy
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
   * [ASSUMED] Heuristic for D-34/D-35 direction classification: a short
   * all-digit destination (no leading '+', no separators) looks like an
   * internal extension rather than an external PSTN number, so DialBegin
   * can tag the attempt 'internal' instead of 'outbound'. Verify against
   * real extension lengths on a live tenant (09-VALIDATION).
   */
  private isInternalNumber(num: string): boolean {
    return /^\d{1,5}$/.test(num);
  }

  /** True when AMI gave us a raw interface string instead of a person name. */
  private isRawAgentName(iface: string, name?: string): boolean {
    if (!name) return true;
    if (name === iface) return true;
    return /^(PJSIP|SIP)\//i.test(name);
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

    const allAgents = this.stateService.getAllAgents(userUid);
    const queueAgents = allAgents.filter(a => a.queues.includes(queueName));

    this.stateService.setQueue(userUid, queueName, {
      waiting,
      talking,
      agents: {
        total: queueAgents.length,
        available: queueAgents.filter(a => a.status === 'READY').length,
        paused: queueAgents.filter(a => a.status === 'PAUSED').length,
        busy: queueAgents.filter(a => a.status === 'IN_CALL' || a.status === 'RINGING').length,
      },
    });
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
   * Write a DIALING/CONSULT/ACW journal row on entry (D-09/D-13); the row's
   * uid + entry time are kept in-memory so logStatusJournalExit can fill in
   * duration once the state ends ? mirrors the "duration filled on exit"
   * shape of the cc_agent_events.duration column comment.
   */
  private async logStatusJournalEnter(agent: AgentState, eventType: 'DIALING' | 'CONSULT' | 'ACW'): Promise<void> {
    const sessionId = await this.findActiveSessionId(agent.userId, agent.interface);
    if (!sessionId) return;
    try {
      const row = await this.agentEventModel.create({
        session_id: sessionId,
        user_id: agent.userId,
        event_type: eventType,
        reason: '',
        call_uniqueid: '',
        caller_id: '',
        queue_name: '',
        duration: 0,
        user_uid: agent.userUid,
      } as any);
      this.statusJournalEntries.set(this.journalKey(agent.userUid, agent.interface), {
        uid: row.getDataValue('uid') as number,
        enteredAt: Date.now(),
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log ${eventType} journal entry: ${err.message}`);
    }
  }

  /** Fill in duration (seconds) on the matching journal row's exit. No-op if no entry is open. */
  private async logStatusJournalExit(agent: AgentState): Promise<void> {
    const key = this.journalKey(agent.userUid, agent.interface);
    const entry = this.statusJournalEntries.get(key);
    if (!entry) return;
    this.statusJournalEntries.delete(key);
    try {
      const durationSec = Math.max(0, Math.round((Date.now() - entry.enteredAt) / 1000));
      await this.agentEventModel.update({ duration: durationSec }, { where: { uid: entry.uid } });
    } catch (err: any) {
      this.logger.warn(`Failed to fill journal exit duration: ${err.message}`);
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
