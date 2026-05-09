/**
 * CallCenter AMI Event Listener.
 *
 * Subscribes to relevant AMI events from the existing AmiService
 * and updates the in-memory CallCenterStateService.
 * Maps raw Asterisk AMI events → structured CC state changes.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService, AgentStatus } from './callcenter-state.service';
import { CcAgentEvent } from './models/agent-event.model';
import { Queue } from '../queues/queue.model';

@Injectable()
export class CallCenterAmiService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterAmiService.name);

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
  ) {}

  async onModuleInit() {
    // Wait a bit for AMI connection to establish
    setTimeout(() => this.initialize(), 3000);
  }

  private async initialize() {
    try {
      // Load initial queue states via QueueStatus AMI action
      await this.loadInitialState();
      this.logger.log('✅ CallCenter AMI listener initialized');
    } catch (err: any) {
      this.logger.warn(`CallCenter AMI init deferred: ${err.message}`);
    }
  }

  /**
   * Load current queue/agent state from Asterisk via QueueStatus AMI command.
   * This populates the in-memory store on startup.
   */
  async loadInitialState(): Promise<void> {
    if (!this.amiService.isConnected()) {
      this.logger.debug('AMI not connected yet, skipping initial state load');
      return;
    }

    // Get all queues from DB to map queue names → tenants
    const dbQueues = await this.queueModel.findAll({ attributes: ['name', 'user_uid', 'display_name'] });
    const queueTenantMap = new Map<string, { userUid: number; displayName: string }>();
    for (const q of dbQueues) {
      queueTenantMap.set(q.getDataValue('name'), {
        userUid: q.getDataValue('user_uid'),
        displayName: q.getDataValue('display_name') || q.getDataValue('name'),
      });
    }

    // Request QueueStatus from Asterisk (returns current agents + callers)
    try {
      const result = await this.amiService.queueStatus();
      this.logger.debug(`QueueStatus raw result keys: ${Object.keys(result || {}).join(', ')}`);
    } catch (err: any) {
      this.logger.warn(`QueueStatus failed: ${err.message}`);
    }

    this.logger.log(`Loaded ${queueTenantMap.size} queues from DB for tenant mapping`);
  }

  // ─── AMI Event Handlers ──────────────────────────────────
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
    if (!userUid) return;

    const status = this.mapAsteriskStatus(evt.status, evt.paused);

    this.stateService.setAgent(userUid, iface, {
      status,
      pauseReason: evt.paused === '1' ? (evt.reason || 'Unknown') : undefined,
      callsTaken: parseInt(evt.callstaken, 10) || 0,
      name: evt.membername || iface,
    });
  }

  /**
   * Handle QueueCallerJoin — a caller entered a queue.
   */
  handleCallerJoin(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName || !uniqueid) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

    this.stateService.setCall(uniqueid, {
      callerIdNum: evt.calleridnum || '',
      callerIdName: evt.calleridname || '',
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
   * Handle AgentConnect — an agent answered a queued call.
   */
  handleAgentConnect(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.destuniqueid || evt.uniqueid;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName || !uniqueid) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

    // Save actual Asterisk channel names — needed for Hold, Transfer, Hangup
    // AgentConnect event fields (asterisk-manager lowercases):
    //   channel      = agent's channel  (e.g. PJSIP/e101_42-00000002)
    //   destchannel  = caller's channel (e.g. PJSIP/trunk-00000001)
    const agentChannel = evt.channel || '';
    const callerChannel = evt.destchannel || '';

    // Update call state with channel info
    this.stateService.setCall(uniqueid, {
      agent: agentInterface,
      agentChannel,
      callerChannel,
      status: 'TALKING',
      answerTime: new Date(),
    });

    // Update agent state
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'IN_CALL',
      currentCall: uniqueid,
    });

    // Emit specific event
    this.stateService.emitEvent('callAnswer', userUid, {
      uniqueid,
      queue: queueName,
      agent: agentInterface,
      holdTime: evt.holdtime || '0',
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle AgentComplete — call finished (agent or caller hung up).
   */
  handleAgentComplete(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.destuniqueid || evt.uniqueid;
    const agentInterface = evt.interface || evt.membername;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

    // Remove call from active
    if (uniqueid) {
      this.stateService.removeCall(uniqueid, 'completed');
    }

    // Agent transitions to WRAPUP (if wrapuptime > 0) or READY
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (agent) {
      const wrapupTime = agent.wrapupTimeout || 0;
      if (wrapupTime > 0) {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'WRAPUP',
          currentCall: undefined,
          callsTaken: (agent.callsTaken || 0) + 1,
          lastCallTime: new Date(),
        });
        this.stateService.emitEvent('wrapupStart', userUid, {
          agent: agentInterface,
          timeout: wrapupTime,
        });
      } else {
        this.stateService.setAgent(userUid, agentInterface, {
          status: 'READY',
          currentCall: undefined,
          callsTaken: (agent.callsTaken || 0) + 1,
          lastCallTime: new Date(),
        });
      }
    }

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle QueueCallerAbandon — caller gave up waiting.
   */
  handleCallerAbandon(evt: any): void {
    const queueName = evt.queue;
    const uniqueid = evt.uniqueid;
    if (!queueName) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

    this.stateService.removeCall(uniqueid, 'abandoned');
    this.stateService.emitEvent('callAbandon', userUid, {
      uniqueid,
      queue: queueName,
      callerIdNum: evt.calleridnum || '',
      holdTime: evt.holdtime || '0',
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle QueueMemberAdded — agent added to queue dynamically.
   */
  handleMemberAdded(evt: any): void {
    const queueName = evt.queue;
    const iface = evt.interface || evt.membername;
    if (!queueName || !iface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

    const agent = this.stateService.getAgent(userUid, iface);
    const queues = agent?.queues || [];
    if (!queues.includes(queueName)) queues.push(queueName);

    this.stateService.setAgent(userUid, iface, {
      queues,
      name: evt.membername || iface,
      status: agent?.status || 'READY',
    });

    this.recalcQueueStats(userUid, queueName);
  }

  /**
   * Handle QueueMemberRemoved — agent removed from queue.
   */
  handleMemberRemoved(evt: any): void {
    const queueName = evt.queue;
    const iface = evt.interface || evt.membername;
    if (!queueName || !iface) return;

    const userUid = this.resolveQueueTenant(queueName);
    if (!userUid) return;

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
   * Handle AMI Hold event — fired when a channel is placed on hold.
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
   * Handle AMI Unhold event — fired when a hold is released.
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

  // ─── Helpers ─────────────────────────────────────────────

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
   * Resolve queue name → tenant userUid.
   * Queue names follow the convention: q{exten}_{vpbxUserUid}
   */
  private resolveQueueTenant(queueName: string): number | null {
    const match = queueName.match(/_(\d+)$/);
    if (match) return parseInt(match[1], 10);
    return null;
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
