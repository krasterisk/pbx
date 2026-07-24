/**
 * CallCenter Business Logic Service.
 *
 * Implements agent/supervisor actions by calling AMI commands
 * and updating the in-memory state store.
 */
import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterPermissionsService } from './callcenter-permissions.service';
import { LoggerService } from '../logger/logger.service';
import type { SpyMode } from './models/cc-permissions.types';
import { CcPauseReason } from './models/pause-reason.model';
import { CcAgentSession } from './models/agent-session.model';
import { CcAgentEvent } from './models/agent-event.model';
import { CcQueueCall } from './models/queue-call.model';
import { CcMissedCall } from './models/missed-call.model';
import { CcContact } from './models/cc-contact.model';
import { TransferDto } from './dto/callcenter.dto';
import { CreateContactDto, SendDtmfDto, UpdateContactDto } from './dto/callcenter-contacts.dto';
import { CallCenterSettingsService } from './callcenter-settings.service';
import { User } from '../users/user.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { ServiceRequest } from '../service-requests/service-request.model';
import { companionIdOf, isWebrtcCompanion, primaryIdOf, extractExtension, interfaceToExtension } from '../endpoints/endpoint-ids.util';
import { Op, fn, col, literal } from 'sequelize';
import { CallCenterPresenceService } from './callcenter-presence.service';
import { Queue } from '../queues/queue.model';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { CallGroup } from '../call-groups/call-group.model';
import { CallGroupMember } from '../call-groups/call-group-member.model';

@Injectable()
export class CallCenterService {
  private readonly logger = new Logger(CallCenterService.name);

  /** Maps userId → active session uid */
  private readonly activeSessions = new Map<string, number>();

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly ccAmiService: CallCenterAmiService,
    private readonly metricsService: CallCenterMetricsService,
    @InjectModel(CcPauseReason) private readonly pauseReasonModel: typeof CcPauseReason,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PhonebookEntry) private readonly phonebookEntryModel: typeof PhonebookEntry,
    @InjectModel(RoutePhonebook) private readonly phonebookModel: typeof RoutePhonebook,
    @InjectModel(ServiceRequest) private readonly serviceRequestModel: typeof ServiceRequest,
    private readonly settingsService: CallCenterSettingsService,
    private readonly permissionsService: CallCenterPermissionsService,
    private readonly loggerService: LoggerService,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    @InjectModel(CallGroup) private readonly callGroupModel: typeof CallGroup,
    @InjectModel(CallGroupMember) private readonly callGroupMemberModel: typeof CallGroupMember,
    private readonly presenceService: CallCenterPresenceService,
    @InjectModel(CcContact) private readonly contactModel: typeof CcContact,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────

  private sessionKey(userUid: number, userId: number): string {
    return `${userUid}:${userId}`;
  }

  /**
   * Queue member interfaces for a primary/WebRTC pair.
   * PJSIP/ew112_0 ↔ PJSIP/e112_0 — logout must remove both (stale SIP member otherwise remains).
   */
  static relatedQueueInterfaces(agentInterface: string): string[] {
    const tech = agentInterface.includes('/')
      ? agentInterface.slice(0, agentInterface.indexOf('/') + 1)
      : 'PJSIP/';
    const sipId = agentInterface.includes('/')
      ? agentInterface.slice(agentInterface.indexOf('/') + 1)
      : agentInterface;

    const related = new Set<string>([`PJSIP/${sipId}`, `${tech}${sipId}`, agentInterface]);
    const twin = isWebrtcCompanion(sipId) ? primaryIdOf(sipId) : companionIdOf(sipId);
    if (twin) {
      related.add(`PJSIP/${twin}`);
      related.add(`${tech}${twin}`);
    }
    return [...related];
  }

  private async queueRemoveAll(queues: string[], agentInterface: string): Promise<void> {
    const ifaces = CallCenterService.relatedQueueInterfaces(agentInterface);
    for (const queue of queues) {
      for (const iface of ifaces) {
        try {
          await this.amiService.queueRemove(queue, iface);
        } catch (err: any) {
          this.logger.warn(`Failed to remove ${iface} from queue ${queue}: ${err.message}`);
        }
      }
    }
  }

  /** Queue-suffix tenant where operator is online, else JWT vpbx (q700_0 vs vpbx=58). */
  private resolveTenant(jwtUserUid: number, userId: number): number {
    return this.stateService.findTenantForOnlineUser(userId) ?? jwtUserUid;
  }

  private async resolveAgentInterface(userUid: number, userId: number): Promise<string | null> {
    const tenant = this.resolveTenant(userUid, userId);
    const agents = this.stateService.getAllAgents(tenant);
    const agent = agents.find(a => a.userId === userId);
    return agent?.interface || null;
  }

  private tenantFromQueues(queues: string[]): number | null {
    for (const q of queues) {
      const t = CallCenterAmiService.parseQueueTenant(q);
      if (t != null) return t;
    }
    return null;
  }

  /** Transfer target must be a known agent interface/exten or queue in this tenant. */
  private isTransferTargetAllowed(userUid: number, target: string): boolean {
    const agents = this.stateService.getAllAgents(userUid);
    for (const agent of agents) {
      if (agent.interface === target) return true;
      const sipId = agent.interface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
      if (sipId === target) return true;
      // e110_0 / ew110_0 → "110"
      const extMatch = sipId.match(/^ew?(.+)_\d+$/);
      if (extMatch && extMatch[1] === target) return true;
    }
    const queues = this.stateService.getAllQueues(userUid);
    return queues.some(q => q.name === target);
  }

  // ─── Agent Actions ──────────────────────────────────────

  async agentLogin(agentInterface: string, queues: string[], userUid: number, userId: number) {
    // In-memory + AMI events use queue suffix (q700_0 → 0), not necessarily JWT vpbx.
    const stateUid = this.tenantFromQueues(queues) ?? userUid;

    // Close any prior open sessions for this user (refresh / re-login)
    await this.sessionModel.update(
      { logout_time: new Date() },
      { where: { user_id: userId, logout_time: null } },
    );

    // Create a session record
    const session = await this.sessionModel.create({
      user_id: userId,
      agent_interface: agentInterface,
      login_time: new Date(),
      user_uid: stateUid,
    });
    this.activeSessions.set(this.sessionKey(stateUid, userId), session.uid);

    // Fresh shift — sinceLogin KPI counters start at 0 (sinceMidnight is untouched, D-11).
    this.metricsService.resetKpiSinceLogin(stateUid, agentInterface);

    // Get user display name
    let displayName = agentInterface;
    try {
      const user = await this.userModel.findOne({ where: { uniqueid: userId } });
      if (user) displayName = user.getDataValue('name') || user.getDataValue('login') || agentInterface;
    } catch { /* ignore */ }

    // Add agent to queues via AMI; drop primary↔webrtc twin so stale members don't linger
    for (const queue of queues) {
      for (const twin of CallCenterService.relatedQueueInterfaces(agentInterface)) {
        if (twin === agentInterface) continue;
        try {
          await this.amiService.queueRemove(queue, twin);
        } catch {
          /* ignore — twin may not be in queue */
        }
      }
      try {
        await this.amiService.queueAdd(queue, agentInterface);
      } catch (err: any) {
        this.logger.warn(`Failed to add ${agentInterface} to queue ${queue}: ${err.message}`);
      }
    }

    const settings = await this.settingsService.getOperatorSettings(stateUid, userId);

    // Update in-memory state (per-operator wrap-up timers loaded once at login)
    this.stateService.setAgent(stateUid, agentInterface, {
      status: 'READY',
      name: displayName,
      queues,
      loginTime: new Date(),
      callsTaken: 0,
      callsMissed: 0,
      callsMade: 0,
      dialTarget: undefined,
      userId,
      wrapupTimeout: settings.wrapup_timeout,
      wrapupExtendStep: settings.wrapup_extend_step,
      wrapupAutosaveDraft: settings.wrapup_autosave_draft,
    });

    // Refresh SSE clients that connected under JWT tenant before shift login
    this.stateService.emitEvent('fullSnapshot', stateUid, this.stateService.getSnapshot(stateUid));

    // Log event
    await this.ccAmiService.logAgentEvent({
      sessionId: session.uid,
      userId,
      eventType: 'LOGIN',
      userUid: stateUid,
    });

    this.logger.log(
      `Agent ${displayName} (${agentInterface}) logged in, queues: [${queues.join(', ')}], stateTenant=${stateUid}`,
    );
    return { success: true, sessionId: session.uid };
  }

  async agentLogout(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    // Close any open timed status (PAUSE / CALL / WRAPUP) before logout
    await this.ccAmiService.endTimedStatus(agent);

    // Accumulate READY idle since last status change when ending the shift
    if (agent.status === 'READY' && agent.statusSince) {
      const idleSec = Math.max(
        0,
        Math.round((Date.now() - new Date(agent.statusSince).getTime()) / 1000),
      );
      if (idleSec > 0) {
        await this.ccAmiService.incrementSessionTotals(userId, agentInterface, {
          total_idle_time: idleSec,
        });
      }
    }

    // Remove from all queues via AMI (primary + WebRTC companion)
    await this.queueRemoveAll(agent.queues, agentInterface);

    // Close session
    const sessionKey = this.sessionKey(userUid, userId);
    const sessionId = this.activeSessions.get(sessionKey);
    if (sessionId) {
      await this.sessionModel.update(
        { logout_time: new Date() },
        { where: { uid: sessionId } },
      );
      this.activeSessions.delete(sessionKey);

      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'LOGOUT',
        userUid,
      });
    }

    // Remove from state
    this.stateService.removeAgent(userUid, agentInterface);

    this.logger.log(`Agent ${agent.name} (${agentInterface}) logged out`);
    return { success: true };
  }

  async agentPause(userUid: number, userId: number, reason?: string, queue?: string) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    // Pause in specific queue or all queues
    const targetQueues = queue ? [queue] : agent.queues;
    for (const q of targetQueues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason);
      } catch (err: any) {
        this.logger.warn(`Failed to pause ${agentInterface} in ${q}: ${err.message}`);
      }
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'PAUSED',
      pauseReason: reason || 'Pause',
    });

    const paused = this.stateService.getAgent(userUid, agentInterface);
    if (paused) {
      await this.ccAmiService.beginTimedStatus(paused, 'PAUSE', reason || 'Pause');
    }

    return { success: true };
  }

  async agentUnpause(userUid: number, userId: number, queue?: string) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    const targetQueues = queue ? [queue] : agent.queues;
    for (const q of targetQueues) {
      try {
        await this.amiService.queuePause(q, agentInterface, false);
      } catch (err: any) {
        this.logger.warn(`Failed to unpause ${agentInterface} in ${q}: ${err.message}`);
      }
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      pauseReason: '',
    });

    const ready = this.stateService.getAgent(userUid, agentInterface);
    if (ready) {
      await this.ccAmiService.endTimedStatus(agent);
      await this.ccAmiService.logAgentEventForAgent(ready, 'READY');
    }

    return { success: true };
  }

  /**
   * Queue-paused outbound work: no inbound from queues, dial-out allowed,
   * counts as working time (not PAUSE journal).
   */
  async agentStartOutboundWork(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    const allowed =
      agent.status === 'READY'
      || agent.status === 'PAUSED'
      || agent.status === 'OUTBOUND_WORK';
    if (!allowed) {
      throw new BadRequestException('Outbound work is only available from READY or PAUSED');
    }

    const reason = 'outbound_work';
    // Set OUTBOUND_WORK before AMI queuePause so QueueMemberPause events do not
    // briefly remap the agent to PAUSED (which flashes "Change pause reason" in UI).
    await this.ccAmiService.endTimedStatus(agent);
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'OUTBOUND_WORK',
      pauseReason: reason,
    });

    for (const q of agent.queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason);
      } catch (err: any) {
        this.logger.warn(`Failed to pause ${agentInterface} in ${q} for outbound work: ${err.message}`);
      }
    }

    const live = this.stateService.getAgent(userUid, agentInterface);
    if (live) {
      await this.ccAmiService.logAgentEventForAgent(live, 'OUTBOUND_WORK', reason);
    }

    return { success: true };
  }

  /** Leave outbound work → READY (unpause queues). */
  async agentLeaveOutboundWork(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');
    if (agent.status !== 'OUTBOUND_WORK') {
      throw new BadRequestException('Agent is not in outbound work');
    }

    return this.agentUnpause(userUid, userId);
  }

  async agentHangup(userUid: number, userId: number, channel?: string) {
    userUid = this.resolveTenant(userUid, userId);
    if (channel) {
      await this.amiService.hangup(channel);
      return { success: true };
    }

    // Find agent's current call and hangup
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent?.currentCall) throw new BadRequestException('No active call to hangup');

    const call = this.stateService.getCall(agent.currentCall);
    if (call) {
      // Hang live channel (not bare interface) — AgentComplete cleans state
      const hangChannel = call.callerChannel || call.agentChannel || agentInterface;
      try {
        await this.amiService.hangup(hangChannel);
      } catch (err: any) {
        this.logger.warn(`Hangup failed for ${hangChannel}: ${err.message}`);
      }
    }

    return { success: true };
  }

  /**
   * Active shift for the current user (survives page refresh).
   * Rebinds in-memory agent.userId from an open DB session when needed.
   */
  async getAgentMe(jwtUserUid: number, userId: number) {
    const session = await this.sessionModel.findOne({
      where: { user_id: userId, logout_time: null },
      order: [['login_time', 'DESC']],
    });

    const tenant =
      this.stateService.findTenantForOnlineUser(userId)
      ?? (session ? Number(session.user_uid) : null)
      ?? jwtUserUid;

    let agent =
      this.stateService.getAllAgents(tenant).find((a) => a.userId === userId)
      || (session
        ? this.stateService.getAgent(Number(session.user_uid), session.agent_interface)
          || this.stateService.getAgent(tenant, session.agent_interface)
        : undefined);

    if (session && agent) {
      this.activeSessions.set(
        this.sessionKey(Number(session.user_uid), userId),
        session.uid,
      );
      // Re-attach login identity after AMI preload (userId was 0)
      if (!agent.userId || agent.userId !== userId) {
        let displayName = agent.name;
        try {
          const user = await this.userModel.findOne({ where: { uniqueid: userId } });
          if (user) {
            displayName =
              user.getDataValue('name') || user.getDataValue('login') || displayName;
          }
        } catch { /* ignore */ }
        this.stateService.setAgent(Number(session.user_uid), session.agent_interface, {
          userId,
          name: displayName,
          loginTime: agent.loginTime || session.login_time,
        });
        agent = this.stateService.getAgent(
          Number(session.user_uid),
          session.agent_interface,
        );
      }
    }

    // Open DB session = shift still active. AMI may flip to OFFLINE when WebRTC
    // WSS drops (tab background) — that must not end the shift for /agent/me.
    if (!session) {
      return { active: false as const };
    }

    if (!agent) {
      return {
        active: true as const,
        interface: session.agent_interface,
        queues: [] as string[],
        status: 'OFFLINE' as const,
        name: session.agent_interface,
        sessionId: session.uid,
        loginTime: session.login_time,
        pauseReason: undefined,
        callsTaken: 0,
      };
    }

    return {
      active: true as const,
      interface: agent.interface,
      queues: agent.queues,
      status: agent.status,
      name: agent.name,
      sessionId: session.uid,
      loginTime: agent.loginTime || session.login_time,
      pauseReason: agent.pauseReason,
      callsTaken: agent.callsTaken,
      callsMissed: agent.callsMissed ?? 0,
      callsMade: agent.callsMade ?? 0,
      statusSince: agent.statusSince,
    };
  }

  /**
   * Current agent's own dual shift/day answered·made·missed KPI (D-11/D-12).
   * Self-scoped only — the agent interface is resolved server-side from the
   * caller's own online presence, never accepted as a client-supplied param,
   * so an operator can never read a coworker's personal counters this way.
   */
  getAgentKpi(userUid: number, userId: number) {
    const agent = this.stateService.getAllAgents(userUid).find((a) => a.userId === userId);
    return this.metricsService.getAgentKpi(userUid, agent?.interface || '');
  }

  /**
   * Current agent's own dual shift/day answered·made·missed KPI per queue (D-31/D-32) —
   * Queues tab (09-08). Self-scoped identically to getAgentKpi: the agent interface and
   * its queue membership are resolved server-side, never accepted from the client.
   */
  getAgentQueuesKpi(userUid: number, userId: number) {
    const agent = this.stateService.getAllAgents(userUid).find((a) => a.userId === userId);
    return this.metricsService.getAgentQueuesKpi(userUid, agent?.interface || '', agent?.queues || []);
  }

  /**
   * Hold — Put the caller on hold (they hear MusicOnHold).
   *
   * Two scenarios:
   * 1. SIP phone initiated — the phone sends SIP re-INVITE (sendonly),
   *    Asterisk fires AMI "Hold" event automatically, our AMI listener
   *    picks it up and updates state. Web button just reflects the status.
   *
   * 2. Web UI initiated — we use AMI "Redirect" to move the caller's
   *    channel into a parking/MOH context. The caller hears music.
   *    The agent channel stays in the bridge (or gets MOH as well).
   *
   * For approach #2, we use AMI Park action which is the cleanest way
   * to hold a call via AMI — it parks the caller and agent can retrieve.
   * Alternative: Redirect to a custom context with MusicOnHold().
   */
  async agentHold(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent?.currentCall) throw new BadRequestException('No active call');

    const call = this.stateService.getCall(agent.currentCall);
    if (!call) throw new BadRequestException('Call state not found');

    // If we have the caller channel, redirect it to MOH context
    if (call.callerChannel) {
      try {
        // Redirect the caller channel to a context with MusicOnHold()
        // This requires a context like [cc-hold] with exten => s,1,MusicOnHold(default)
        // Alternatively, use the built-in Asterisk Park action
        await this.amiService.action({
          action: 'Redirect',
          channel: call.callerChannel,
          context: 'cc-hold',
          exten: 's',
          priority: '1',
        });
        this.logger.log(`Hold: redirected caller ${call.callerChannel} to MOH`);
      } catch (err: any) {
        this.logger.warn(`Hold AMI redirect failed: ${err.message}, updating state only`);
      }
    }

    // Update state (will also be updated by AMI Hold event if SIP-phone hold)
    this.stateService.setCall(agent.currentCall, { status: 'HOLD' });
    this.stateService.emitEvent('callHold', userUid, {
      uniqueid: agent.currentCall,
      agent: agentInterface,
    });

    // Log event
    const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
    if (sessionId) {
      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'HOLD',
        callUniqueid: agent.currentCall,
        userUid,
      });
    }

    return { success: true };
  }

  /**
   * Unhold — Retrieve the caller from hold.
   *
   * If hold was done via Redirect (web UI), we redirect the caller back
   * to the agent's bridge. If hold was SIP-phone initiated, the phone
   * sends re-INVITE to resume and Asterisk fires AMI "Unhold".
   */
  async agentUnhold(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent?.currentCall) throw new BadRequestException('No active call');

    const call = this.stateService.getCall(agent.currentCall);
    if (!call) throw new BadRequestException('Call state not found');

    // If we have the caller channel, redirect back to agent bridge
    if (call.callerChannel && call.agentChannel) {
      try {
        // Redirect caller back to the agent's channel context
        // Using the agent interface extension to re-bridge
        const agentExten = agentInterface.replace('PJSIP/', '');
        await this.amiService.action({
          action: 'Redirect',
          channel: call.callerChannel,
          context: 'from-internal',
          exten: agentExten,
          priority: '1',
        });
        this.logger.log(`Unhold: redirected caller ${call.callerChannel} back to ${agentExten}`);
      } catch (err: any) {
        this.logger.warn(`Unhold AMI redirect failed: ${err.message}, updating state only`);
      }
    }

    // Update state
    this.stateService.setCall(agent.currentCall, { status: 'TALKING' });
    this.stateService.emitEvent('callUnhold', userUid, {
      uniqueid: agent.currentCall,
      agent: agentInterface,
    });

    // Log event
    const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
    if (sessionId) {
      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'UNHOLD',
        callUniqueid: agent.currentCall,
        userUid,
      });
    }

    return { success: true };
  }

  async agentTransfer(dto: TransferDto, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    if (!this.amiService.isConnected()) {
      throw new BadRequestException('AMI not connected');
    }

    if (!this.isTransferTargetAllowed(userUid, dto.target)) {
      throw new ForbiddenException('Transfer target not allowed');
    }

    // For blind transfer, use AMI Redirect
    if (dto.type === 'blind') {
      const call = this.stateService.getCall(dto.uniqueid);
      if (!call) throw new NotFoundException('Call not found');

      if (!call.callerChannel) {
        throw new BadRequestException('Caller channel not available');
      }

      // Redirect the caller's Asterisk channel (not CallerID) to the target extension
      try {
        await this.amiService.action({
          action: 'Redirect',
          channel: call.callerChannel,
          context: 'from-internal',
          exten: dto.target,
          priority: '1',
        });
      } catch (err: any) {
        throw new BadRequestException(`Transfer failed: ${err.message}`);
      }
    }

    // Attended transfer would be handled by the SIP phone
    return { success: true };
  }

  async agentWrapupDone(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    // Cancel auto-timeout timer if pending
    this.ccAmiService.cancelWrapupTimer(userUid, agentInterface);

    await this.ccAmiService.endTimedStatus(agent);
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      currentCall: undefined,
    });

    this.stateService.emitEvent('wrapupEnd', userUid, { agent: agentInterface, reason: 'manual' });

    const ready = this.stateService.getAgent(userUid, agentInterface);
    if (ready) {
      await this.ccAmiService.logAgentEventForAgent(ready, 'WRAPUP_END', 'manual');
    }

    return { success: true };
  }

  async agentWrapupExtend(userUid: number, userId: number, seconds?: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const settings = await this.settingsService.getOperatorSettings(userUid, userId);
    const addSeconds = seconds ?? settings.wrapup_extend_step;

    this.ccAmiService.extendWrapupTimer(userUid, agentInterface, addSeconds);

    return { success: true };
  }

  // ─── Supervisor Actions ─────────────────────────────────

  async supervisorSpy(agentInterface: string, mode: 'spy' | 'whisper' | 'barge', userUid: number, supervisorId: number) {
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent || agent.status !== 'IN_CALL') {
      throw new BadRequestException('Agent is not on a call');
    }

    // ChanSpy via AMI Originate
    // mode: spy = 'q' (quiet), whisper = 'w', barge = 'B'
    const spyOptions = mode === 'spy' ? 'q' : mode === 'whisper' ? 'w' : 'B';

    // Get supervisor's SIP interface
    const supervisor = await this.userModel.findOne({ where: { uniqueid: supervisorId, vpbx_user_uid: userUid } });
    if (!supervisor) throw new NotFoundException('Supervisor not found');

    // Build the ChanSpy channel — supervisor's device rings and connects to spy
    const supervisorExten = supervisor.getDataValue('extension') || supervisor.getDataValue('login');
    const spyChannel = `PJSIP/${supervisorExten}`;

    try {
      await this.amiService.originate(
        spyChannel,
        `Spy on ${agent.name}`,
        'from-internal',  // context
        `ChanSpy(${agentInterface},${spyOptions})`,
      );
    } catch (err: any) {
      throw new BadRequestException(`Spy failed: ${err.message}`);
    }

    this.logger.log(`Supervisor ${supervisorId} started ${mode} on ${agentInterface}`);
    return { success: true, mode };
  }

  // ─── Peer Actions (D-21…D-25) ───────────────────────────

  /**
   * Coworker↔coworker ChanSpy — the permission+scope+audit-gated peer analog of
   * supervisorSpy (which has no permission check beyond controller-level assertSupervisor).
   * Check order (RESEARCH Pitfall 2): target must be IN_CALL → shared online queue →
   * target spyable → requester can_spy → mode ∈ requester spy_modes → audit log → AMI originate.
   * A supervisor calling this endpoint is scoped by the same shared-queue check as any
   * other agent (D-25) — this endpoint never grants tenant-wide reach the way
   * supervisor/spy does; that broader supervisor tool is untouched by this method.
   */
  async peerSpy(requesterUserId: number, targetInterface: string, mode: SpyMode, userUid: number) {
    userUid = this.resolveTenant(userUid, requesterUserId);

    const requesterAgent = this.stateService
      .getAllAgents(userUid)
      .find(a => a.userId === requesterUserId);
    if (!requesterAgent) throw new NotFoundException('Requester agent not logged in');

    const targetAgent = this.stateService.getAgent(userUid, targetInterface);
    if (!targetAgent) throw new NotFoundException('Target agent not found');
    if (targetAgent.userUid !== userUid) {
      throw new BadRequestException('Agent belongs to another tenant');
    }
    if (targetAgent.status !== 'IN_CALL') {
      throw new BadRequestException('Agent is not on a call');
    }

    const sharedQueue = requesterAgent.queues.some(q => targetAgent.queues.includes(q));
    if (!sharedQueue) {
      throw new ForbiddenException('Not in a shared queue with the target agent');
    }

    const targetPerms = await this.permissionsService.getEffective(userUid, targetAgent.userId);
    if (!targetPerms.spyable) {
      throw new ForbiddenException('Target is not spyable');
    }

    const requesterPerms = await this.permissionsService.getEffective(userUid, requesterUserId);
    if (!requesterPerms.can_spy) {
      throw new ForbiddenException('can_spy not granted');
    }
    if (!requesterPerms.spy_modes.includes(mode)) {
      throw new ForbiddenException(`Mode ${mode} not granted`);
    }

    // D-24: audit row written before AMI originate — listen mode stays silent to the target,
    // but every spy invocation (any mode) must be attributable after the fact.
    await this.loggerService.logAction(
      requesterUserId,
      'peer_spy',
      'cc_agent',
      targetAgent.userId || null,
      userUid,
      `mode=${mode} target=${targetInterface}`,
    );

    const spyOptions = mode === 'listen' ? 'q' : mode === 'whisper' ? 'w' : 'B';

    try {
      await this.amiService.originate(
        requesterAgent.interface,
        `Peer spy on ${targetAgent.name}`,
        'from-internal',
        `ChanSpy(${targetInterface},${spyOptions})`,
      );
    } catch (err: any) {
      throw new BadRequestException(`Spy failed: ${err.message}`);
    }

    this.logger.log(`Peer spy: ${requesterUserId} started ${mode} on ${targetInterface}`);
    return { success: true, mode };
  }

  async supervisorForcePause(agentInterface: string, reason: string | undefined, userUid: number) {
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent not found');

    for (const q of agent.queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason || 'Forced by supervisor');
      } catch { /* ignore */ }
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'PAUSED',
      pauseReason: reason || 'Forced by supervisor',
    });

    const paused = this.stateService.getAgent(userUid, agentInterface);
    if (paused) {
      await this.ccAmiService.beginTimedStatus(
        paused,
        'PAUSE',
        reason || 'Forced by supervisor',
      );
    }

    return { success: true };
  }

  async supervisorForceUnpause(agentInterface: string, userUid: number) {
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent not found');

    for (const q of agent.queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, false);
      } catch { /* ignore */ }
    }

    await this.ccAmiService.endTimedStatus(agent);
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      pauseReason: '',
    });

    const ready = this.stateService.getAgent(userUid, agentInterface);
    if (ready) {
      await this.ccAmiService.logAgentEventForAgent(ready, 'READY');
    }

    return { success: true };
  }

  async supervisorQueueAdd(agentInterface: string, queue: string, penalty: number | undefined, userUid: number) {
    try {
      await this.amiService.queueAdd(queue, agentInterface, penalty);
    } catch (err: any) {
      throw new BadRequestException(`Failed to add to queue: ${err.message}`);
    }

    // State will be updated by AMI QueueMemberAdded event
    this.logger.log(`Supervisor added ${agentInterface} to queue ${queue}`);
    return { success: true };
  }

  async supervisorQueueRemove(agentInterface: string, queue: string, userUid: number) {
    try {
      await this.amiService.queueRemove(queue, agentInterface);
    } catch (err: any) {
      throw new BadRequestException(`Failed to remove from queue: ${err.message}`);
    }

    this.logger.log(`Supervisor removed ${agentInterface} from queue ${queue}`);
    return { success: true };
  }

  async supervisorQueuePenalty(agentInterface: string, queue: string, penalty: number, userUid: number) {
    try {
      await this.amiService.action({
        action: 'QueuePenalty',
        Interface: agentInterface,
        Penalty: String(penalty),
        Queue: queue,
      });
    } catch (err: any) {
      throw new BadRequestException(`Queue penalty failed: ${err.message}`);
    }

    this.logger.log(`Supervisor set penalty ${penalty} for ${agentInterface} in ${queue}`);
    return { success: true };
  }

  async supervisorForceLogout(agentInterface: string, userUid: number) {
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent not found');

    await this.queueRemoveAll(agent.queues, agentInterface);

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'OFFLINE',
      queues: [],
    });

    this.logger.log(`Supervisor force-logout ${agentInterface}`);
    return { success: true };
  }

  async supervisorRedirectCall(uniqueid: string, target: string, userUid: number) {
    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (!call.callerChannel) {
      throw new BadRequestException('Caller channel not available');
    }

    const exten = target.replace(/^PJSIP\//, '').replace(/^SIP\//, '');

    try {
      await this.amiService.action({
        action: 'Redirect',
        channel: call.callerChannel,
        context: 'from-internal',
        exten,
        priority: '1',
      });
    } catch (err: any) {
      throw new BadRequestException(`Redirect failed: ${err.message}`);
    }

    return { success: true, uniqueid, target: exten };
  }

  async supervisorHangupCall(uniqueid: string, userUid: number) {
    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }

    const channel = call.callerChannel || call.agentChannel;
    if (!channel) {
      throw new BadRequestException('Caller channel not available');
    }

    try {
      await this.amiService.hangup(channel);
    } catch (err: any) {
      throw new BadRequestException(`Hangup failed: ${err.message}`);
    }

    return { success: true };
  }

  // ─── Call Control (D-27/D-28/D-29/D-33) ─────────────────
  //
  // Every method below opens with the same guard sequence: resolve the
  // requesting operator's own agentInterface → getCall → tenant guard →
  // own-call ownership guard (call.agent === agentInterface) → channel
  // presence guard — *before* touching AMI. No client-supplied userUid is
  // ever trusted; ids are always resolved server-side from the JWT.

  /**
   * Park the operator's own active call (D-28). Ownership-scoped like
   * agentHangup/resetZombieCall — an agent can only park their own call.
   * [ASSUMED] the exact AMI Park response field carrying the parking-space
   * extension is not verified against a live Asterisk instance in this repo
   * (09-RESEARCH.md confidence: MEDIUM) — surfaced best-effort for the UI.
   */
  async parkCall(uniqueid: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.agent !== agentInterface) {
      throw new ForbiddenException("Only the operator's own call can be parked");
    }
    if (!call.callerChannel) {
      throw new BadRequestException('Caller channel not available');
    }

    let res: any;
    try {
      res = await this.amiService.park(call.callerChannel);
    } catch (err: any) {
      throw new BadRequestException(`Park failed: ${err.message}`);
    }

    this.stateService.setCall(uniqueid, { status: 'HOLD' });
    this.logger.log(`Parked call ${uniqueid} (${call.callerChannel}) by ${agentInterface}`);

    const parkingSpace: string | null = res?.exten || res?.parkinglot || null;
    // Delta-driven refresh for every operator's ParkedCallsIndicator (D-45, 09-10).
    this.stateService.emitEvent('parkedCallsUpdate', userUid, { parkingSpace, action: 'parked' });

    return {
      success: true,
      uniqueid,
      // [ASSUMED] field name — verify on live Asterisk (09-VALIDATION).
      parkingSpace,
    };
  }

  /**
   * Retrieve a parked call into the requesting operator's own device (D-28).
   * Parked calls sit in a tenant-wide parking lot (not owned by a specific
   * agent), so beyond being a logged-in agent no further ownership check
   * applies — any operator in the tenant may retrieve any parked call.
   */
  async retrieveParkedCall(parkingSpace: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    if (!parkingSpace || !parkingSpace.trim()) {
      throw new BadRequestException('Parking space is required');
    }

    try {
      await this.amiService.originate(
        agentInterface,
        `Retrieve parked call ${parkingSpace}`,
        'parkedcalls',
        parkingSpace,
      );
    } catch (err: any) {
      throw new BadRequestException(`Retrieve failed: ${err.message}`);
    }

    this.logger.log(`Agent ${agentInterface} retrieving parked call ${parkingSpace}`);
    // Delta-driven refresh for every operator's ParkedCallsIndicator (D-45, 09-10).
    this.stateService.emitEvent('parkedCallsUpdate', userUid, { parkingSpace, action: 'retrieved' });
    return { success: true, parkingSpace };
  }

  /**
   * List the tenant's currently parked calls (D-28, 09-10 ParkedCallsIndicator).
   * Parking is a tenant-wide lot (see retrieveParkedCall) — only requires the
   * requester to be a logged-in agent, matching that method's ownership model.
   */
  async getParkedCalls(userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    let events: any[] = [];
    try {
      const res = await this.amiService.parkedCalls();
      events = res?.events || [];
    } catch (err: any) {
      this.logger.warn(`getParkedCalls: AMI query failed: ${err.message}`);
      return [];
    }

    return events.map((evt) => ({
      // [ASSUMED] field names — verify on live Asterisk (09-VALIDATION), same
      // caveat as parkCall's response-field assumption above.
      parkingSpace: evt?.exten || evt?.parkinglot || '',
      callerIdNum: evt?.calleridnum || evt?.callerid || '',
      callerIdName: evt?.calleridname || '',
      channel: evt?.channel || undefined,
      timeoutSec: evt?.timeout != null ? Number(evt.timeout) : undefined,
    }));
  }

  /**
   * Add a third party to the operator's own active call via ConfBridge (D-28).
   * Both existing legs are moved into the same conference room in one atomic
   * Redirect (Channel + ExtraChannel keeps the bridge intact); the target is
   * brought in via Originate. Uses the same ad hoc dialplan-app-string
   * convention already used by supervisorSpy/peerSpy's ChanSpy-via-Originate
   * above (RESEARCH Alternatives Considered) rather than inventing a new AMI
   * mechanism. [ASSUMED — relies on existing dialplan evaluating this exten
   * as ConfBridge(); verify on live Asterisk, 09-VALIDATION.]
   */
  async addToConference(uniqueid: string, target: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.agent !== agentInterface) {
      throw new ForbiddenException("Only the operator's own call can be conferenced");
    }
    if (!call.callerChannel || !call.agentChannel) {
      throw new BadRequestException('Call channels not available yet');
    }
    if (!target || !target.trim()) {
      throw new BadRequestException('Conference target is required');
    }

    const room = uniqueid.replace(/[^A-Za-z0-9_-]/g, '');
    const exten = target.replace(/^PJSIP\//, '').replace(/^SIP\//, '');

    try {
      await this.amiService.action({
        action: 'Redirect',
        channel: call.callerChannel,
        context: 'from-internal',
        exten: `ConfBridge(${room})`,
        priority: '1',
        extrachannel: call.agentChannel,
        extracontext: 'from-internal',
        extraexten: `ConfBridge(${room})`,
        extrapriority: '1',
      });
      await this.amiService.originate(
        `PJSIP/${exten}`,
        `Conference ${room}`,
        'from-internal',
        `ConfBridge(${room})`,
      );
    } catch (err: any) {
      throw new BadRequestException(`Conference failed: ${err.message}`);
    }

    this.stateService.setCall(uniqueid, { status: 'TALKING' });
    this.logger.log(`Conference ${room} started by ${agentInterface} with ${exten}`);
    return { success: true, room, target: exten };
  }

  /**
   * Operator self-serve reset of a "zombie" call — a channel stuck in the
   * panel with no BYE, per D-27. Strictly own-call only (never a coworker's,
   * unlike supervisorHangupCall) — this is the anti-griefing guard from the
   * threat model (T-09-07-01). Hangup is attempted best-effort; local state
   * is always cleared so the operator is never stuck behind a truly dead
   * channel even if the AMI Hangup itself fails.
   */
  async resetZombieCall(uniqueid: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.agent !== agentInterface) {
      throw new ForbiddenException("Only the operator's own call can be reset");
    }

    const channel = call.callerChannel || call.agentChannel;
    if (channel) {
      try {
        await this.amiService.hangup(channel);
      } catch (err: any) {
        this.logger.warn(`Zombie-reset hangup failed for ${channel}: ${err.message} — clearing state anyway`);
      }
    }

    this.stateService.removeCall(uniqueid, 'zombie-reset');
    this.stateService.setAgent(userUid, agentInterface, { status: 'READY', currentCall: undefined });

    await this.loggerService.logAction(
      userId,
      'zombie_reset',
      'cc_call',
      null,
      userUid,
      `uniqueid=${uniqueid} agent=${agentInterface}`,
    );

    this.logger.log(`Zombie call ${uniqueid} reset by ${agentInterface}`);
    return { success: true, uniqueid };
  }

  /**
   * Warm transfer of the operator's own active call into a target queue (D-33).
   * Queue-only (not an arbitrary extension/agent — that's agentTransfer's
   * blind mode) and ownership-scoped, unlike agentTransfer which has no
   * per-call ownership check.
   */
  async warmTransferToQueue(uniqueid: string, queue: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.agent !== agentInterface) {
      throw new ForbiddenException("Only the operator's own call can be transferred");
    }
    if (!call.callerChannel) {
      throw new BadRequestException('Caller channel not available');
    }

    const queues = this.stateService.getAllQueues(userUid);
    if (!queues.some((q) => q.name === queue)) {
      throw new BadRequestException('Unknown target queue');
    }

    try {
      await this.amiService.action({
        action: 'Redirect',
        channel: call.callerChannel,
        context: 'from-internal',
        exten: queue,
        priority: '1',
      });
    } catch (err: any) {
      throw new BadRequestException(`Warm transfer failed: ${err.message}`);
    }

    this.stateService.setCall(uniqueid, { status: 'TRANSFERRED', queue });
    this.logger.log(`Warm transfer of ${uniqueid} to queue ${queue} by ${agentInterface}`);
    return { success: true, uniqueid, queue };
  }

  /**
   * Client-aware click-to-call (D-29): WebRTC clients dial directly over
   * their own signalling (nothing to originate server-side); PJSIP clients
   * (softphone/hardware) get an operator-leg Originate with an auto-answer
   * Call-Info header, then dial the target — same scheme as the D-18
   * missed-call callback flow. Gated by the click_to_call permission
   * (D-38/D-39), resolved server-side — never trusted from the client.
   * [ASSUMED] exact SIPADDHEADER Call-Info syntax for auto-answer — verify
   * against the live PJSIP endpoint config (09-VALIDATION).
   */
  async clickToCall(target: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    await this.permissionsService.assert(userUid, userId, 'click_to_call');

    return this.originateDial(agentInterface, target);
  }

  /**
   * Shared WebRTC-direct / PJSIP-originate-with-auto-answer dial, used by
   * both clickToCall (D-29) and callbackMissedCall (D-18) — same scheme,
   * never duplicated (09-09 Task 2).
   */
  private async originateDial(
    agentInterface: string,
    target: string,
  ): Promise<{ success: true; mode: 'webrtc' | 'pjsip'; target: string }> {
    const dialTarget = (target || '').replace(/[^\d+*#]/g, '');
    if (!dialTarget) {
      throw new BadRequestException('Target is required');
    }

    const sipId = agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');

    if (isWebrtcCompanion(sipId)) {
      // WebRTC dials directly through its own client signalling — no AMI action here.
      this.logger.log(`Click-to-call (webrtc) ${agentInterface} -> ${dialTarget}`);
      return { success: true, mode: 'webrtc' as const, target: dialTarget };
    }

    try {
      await this.amiService.action({
        action: 'Originate',
        channel: agentInterface,
        context: 'from-internal',
        exten: dialTarget,
        priority: '1',
        callerid: `Click-to-call <${dialTarget}>`,
        async: 'true',
        variable: 'SIPADDHEADER=Call-Info: <sip:click-to-call>\\;answer-after=0',
      });
    } catch (err: any) {
      throw new BadRequestException(`Click-to-call failed: ${err.message}`);
    }

    this.logger.log(`Click-to-call (pjsip) ${agentInterface} -> ${dialTarget}`);
    return { success: true, mode: 'pjsip' as const, target: dialTarget };
  }

  /**
   * D-18/D-29: operator-initiated callback for a missed-call number, reusing
   * clickToCall's WebRTC-direct/PJSIP-originate branching. Gated only by an
   * active shift (logged-in agent) — missed-call worklist callback is core
   * operator work and must not require the separate click_to_call right.
   */
  async callbackMissedCall(userUid: number, operatorUserId: number, callerIdNum: string) {
    userUid = this.resolveTenant(userUid, operatorUserId);
    const agentInterface = await this.resolveAgentInterface(userUid, operatorUserId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');
    if (!callerIdNum) throw new BadRequestException('callerIdNum is required');

    const result = await this.originateDial(agentInterface, callerIdNum);
    this.trackCallbackOutcome(userUid, agentInterface, callerIdNum, operatorUserId);
    return result;
  }

  /**
   * Watches the operator's AgentState for the IN_CALL -> not-IN_CALL
   * transition following a callback dial and measures its duration
   * (D-18's >5s rule). Fire-and-forget — never blocks the REST response.
   * Gives up after 2 minutes if the call never appears to connect/end.
   */
  private trackCallbackOutcome(
    userUid: number,
    agentInterface: string,
    callerIdNum: string,
    operatorUserId: number,
  ): void {
    let answeredAt: number | undefined;
    let settled = false;

    const finish = (connected: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.unsubscribe();
      const durationSec = answeredAt !== undefined ? (Date.now() - answeredAt) / 1000 : 0;
      void this.resolveCallbackOutcome(userUid, operatorUserId, callerIdNum, connected && durationSec > 5);
    };

    const timer = setTimeout(() => finish(false), 120_000);
    const sub = this.stateService.getEventStream(userUid).subscribe((evt) => {
      if (evt.type !== 'agentUpdate' || evt.data?.interface !== agentInterface) return;
      if (evt.data.status === 'IN_CALL' && answeredAt === undefined) {
        answeredAt = Date.now();
        return;
      }
      if (answeredAt !== undefined && evt.data.status !== 'IN_CALL') {
        finish(true);
      }
    });
  }

  private async resolveCallbackOutcome(
    userUid: number,
    operatorUserId: number,
    callerIdNum: string,
    success: boolean,
  ): Promise<void> {
    try {
      if (success) {
        await this.missedCallModel.update(
          { called_back: true, called_back_by: operatorUserId, called_back_at: new Date() },
          {
            where: {
              user_uid: userUid,
              caller_id_num: callerIdNum,
              called_back: false,
              client_called_back: false,
            },
          },
        );
        this.stateService.emitEvent('missedCallUpdate', userUid, {
          callerIdNum,
          called_back: true,
          called_back_by: operatorUserId,
        });
      } else {
        await this.missedCallModel.create({
          call_uniqueid: `callback-${userUid}-${callerIdNum}-${Date.now()}`,
          queue_name: 'callback-attempt',
          caller_id_num: callerIdNum,
          caller_id_name: '',
          hold_time: 0,
          position: 0,
          called_back: false,
          client_called_back: false,
          personal: false,
          user_uid: userUid,
        });
        this.stateService.emitEvent('missedCallUpdate', userUid, { callerIdNum, attempt: true });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to resolve callback outcome: ${err.message}`);
    }
  }

  /**
   * Agent detail for supervisor modal: today's stats + timeline segments (D-36 contract).
   * Segments are built server-side from cc_agent_events; presentation is AgentTimeline (07-09).
   */
  async getAgentDetail(agentInterface: string, userUid: number) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const queueCalls = await this.queueCallModel.findAll({
      where: {
        user_uid: userUid,
        agent_interface: agentInterface,
        created_at: { [Op.gte]: startOfDay },
      },
    });

    const callsHandled = queueCalls.filter(c => c.disposition === 'answered').length;
    const totalTalk = queueCalls.reduce((s, c) => s + (c.talk_time || 0), 0);
    const totalHold = queueCalls.reduce((s, c) => s + (c.hold_time || 0), 0);
    const aht = Math.round(totalTalk / Math.max(callsHandled, 1));

    const liveAgent = this.stateService.getAgent(userUid, agentInterface);

    const todaySessions = await this.sessionModel.findAll({
      where: {
        user_uid: userUid,
        agent_interface: agentInterface,
        login_time: { [Op.gte]: startOfDay },
      },
      attributes: ['uid'],
    });
    const sessionIds = todaySessions.map(s => s.uid);

    let events: CcAgentEvent[] = [];
    if (sessionIds.length > 0) {
      events = await this.agentEventModel.findAll({
        where: {
          user_uid: userUid,
          session_id: { [Op.in]: sessionIds },
          created_at: { [Op.gte]: startOfDay },
        },
        order: [['created_at', 'ASC']],
      });
    }

    const segments = this.buildAgentTimelineSegments(events);

    return {
      stats: {
        status: liveAgent?.status || 'OFFLINE',
        pauseReason: liveAgent?.pauseReason,
        callsHandled,
        callsTaken: liveAgent?.callsTaken ?? 0,
        totalTalk,
        aht,
        totalHold,
        queues: liveAgent?.queues ?? [],
      },
      segments,
    };
  }

  /**
   * Maps cc_agent_events to contiguous timeline segments (shared contract with reports getAgentTimeline).
   */
  private buildAgentTimelineSegments(events: CcAgentEvent[]) {
    if (events.length === 0) return [];

    const now = new Date();
    const segments: Array<{
      state: string;
      startTs: string;
      endTs: string;
      durationSec: number;
      reason?: string;
    }> = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const start = ev.created_at || now;
      const end = i + 1 < events.length ? (events[i + 1].created_at || now) : now;
      const durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

      segments.push({
        state: this.eventTypeToTimelineState(ev.event_type),
        startTs: start.toISOString(),
        endTs: end.toISOString(),
        durationSec,
        reason: ev.reason || undefined,
      });
    }

    return segments;
  }

  /** event_type → AgentTimeline segment.state (status palette) */
  private eventTypeToTimelineState(eventType: string): string {
    switch (eventType) {
      case 'LOGIN':
      case 'READY':
      case 'CALL_END':
      case 'WRAPUP_END':
        return 'READY';
      case 'PAUSE':
        return 'PAUSED';
      case 'CALL_START':
      case 'UNHOLD':
        return 'IN_CALL';
      case 'HOLD':
        return 'HOLD';
      case 'WRAPUP_START':
        return 'WRAPUP';
      /** Phase 9 (D-09/D-13): dialing/consultation/after-call-work segments. */
      case 'DIALING':
        return 'DIALING';
      case 'CONSULT':
        return 'CONSULT';
      case 'ACW':
        return 'ACW';
      case 'LOGOUT':
        return 'OFFLINE';
      default:
        return 'OFFLINE';
    }
  }

  // ─── Pause Reasons CRUD ─────────────────────────────────

  async getPauseReasons(userUid: number) {
    return this.pauseReasonModel.findAll({
      where: { user_uid: userUid },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
  }

  async createPauseReason(dto: any, userUid: number) {
    return this.pauseReasonModel.create({ ...dto, user_uid: userUid });
  }

  async updatePauseReason(id: number, dto: any, userUid: number) {
    const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
    if (!reason) throw new NotFoundException('Pause reason not found');
    return reason.update(dto);
  }

  async deletePauseReason(id: number, userUid: number) {
    const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
    if (!reason) throw new NotFoundException('Pause reason not found');
    await reason.destroy();
    return { success: true };
  }

  // ─── Softphone contact book (D-11…D-15) ─────────────────

  /** Tenant-scoped shared book for Contacts "Книга" — never trust client tenant ids. */
  async getMyContacts(userUid: number) {
    return this.contactModel.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });
  }

  async createContact(dto: CreateContactDto, userUid: number, userId: number) {
    return this.contactModel.create({
      name: dto.name,
      number: dto.number,
      note: dto.note ?? null,
      user_uid: userUid,
      created_by: userId,
    });
  }

  /**
   * D-13: ownership folded into where (operator = own rows only; supervisor any tenant row).
   * Never a post-fetch ownership if — NotFound when absent from filtered where.
   */
  async updateContact(
    id: number,
    dto: UpdateContactDto,
    userUid: number,
    userId: number,
    isSupervisor: boolean,
  ) {
    const where: Record<string, number> = { uid: id, user_uid: userUid };
    if (!isSupervisor) where.created_by = userId;
    const row = await this.contactModel.findOne({ where });
    if (!row) throw new NotFoundException('Contact not found');
    // Never trust client user_uid / created_by — only whitelist fields from DTO.
    const patch: { name?: string; number?: string; note?: string | null } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.number !== undefined) patch.number = dto.number;
    if (dto.note !== undefined) patch.note = dto.note;
    return row.update(patch);
  }

  async deleteContact(
    id: number,
    userUid: number,
    userId: number,
    isSupervisor: boolean,
  ) {
    const where: Record<string, number> = { uid: id, user_uid: userUid };
    if (!isSupervisor) where.created_by = userId;
    const row = await this.contactModel.findOne({ where });
    if (!row) throw new NotFoundException('Contact not found');
    await row.destroy();
    return { success: true };
  }

  /**
   * SIP-mode in-call DTMF via AMI PlayDTMF (D-32).
   * Channel is resolved from the caller's own active call — never client-supplied.
   * Digit must already be a single [0-9*#A-D] (DTO + defense-in-depth here).
   */
  async sendDtmf(userUid: number, userId: number, uniqueid: string, digit: string) {
    if (!/^[0-9*#A-D]$/.test(digit)) {
      throw new BadRequestException('Invalid DTMF digit');
    }

    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.agent !== agentInterface) {
      throw new ForbiddenException("Only the operator's own call can receive DTMF");
    }

    const channel = call.agentChannel || call.callerChannel;
    if (!channel) {
      throw new BadRequestException('Call channel not available');
    }

    try {
      await this.amiService.playDtmf(channel, digit);
    } catch (err: any) {
      this.logger.warn(`PlayDTMF failed for ${channel} digit=${digit}: ${err?.message}`);
      throw new BadRequestException(`DTMF failed: ${err?.message}`);
    }

    return { success: true, uniqueid, digit };
  }

  /**
   * Operator's own endpoint online/offline for SIP softphone trigger (D-35).
   * Extension/mode re-derived server-side — never trust client-supplied mode.
   * [ASSUMED — A3] DeviceState state strings via CallCenterPresenceService.
   */
  async getMyRegistrationState(userUid: number, userId: number): Promise<{ online: boolean }> {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) {
      return { online: false };
    }

    const sipId = agentInterface.includes('/')
      ? agentInterface.slice(agentInterface.indexOf('/') + 1)
      : agentInterface;
    // WebRTC companion → look up primary SIP handset registration; else self.
    const endpointId = isWebrtcCompanion(sipId) ? (primaryIdOf(sipId) ?? sipId) : sipId;
    const extension = extractExtension(endpointId);

    const state = this.presenceService.getPresence(userUid, extension);
    if (!state) {
      return { online: false };
    }
    // Offline DeviceState values; anything else (NOT_INUSE/INUSE/BUSY/RINGING/…) = online.
    const offline = /^(unavailable|invalid|unknown)$/i.test(String(state).trim());
    return { online: !offline };
  }

  /**
   * Resolve AMI Redirect target for an agent interface.
   * Uses the endpoint's real dialplan context (tenant-suffixed, e.g. from-internal0)
   * and the numeric extension (ew112_0 → 112) — never raw SIP id / bare from-internal.
   */
  private async resolveAgentRedirectTarget(
    userUid: number,
    agentInterface: string,
  ): Promise<{ exten: string; context: string }> {
    const exten = interfaceToExtension(agentInterface);
    const sipId = agentInterface.includes('/')
      ? agentInterface.slice(agentInterface.indexOf('/') + 1)
      : agentInterface;
    const primaryId = primaryIdOf(sipId) ?? sipId;

    try {
      const ep =
        (await this.endpointModel.findByPk(primaryId))
        ?? (await this.endpointModel.findByPk(sipId));
      const ctx =
        ep?.getDataValue?.('context')
        ?? (ep as { context?: string } | null)?.context;
      if (ctx && String(ctx).trim()) {
        return { exten, context: String(ctx).trim() };
      }
    } catch (err: any) {
      this.logger.warn(`resolveAgentRedirectTarget: endpoint lookup failed: ${err.message}`);
    }

    // Last resort: tenant-suffixed default (endpoints.service buildContext pattern)
    return { exten, context: `from-internal${userUid}` };
  }

  // ─── Pick Call ──────────────────────────────────────────
  //
  // Pick Call: agent manually grabs a waiting caller from a queue.
  // AMI Redirect of the caller channel to the agent's dialplan extension
  // (endpoint context + numeric exten), bypassing queue strategy.

  async agentPickCall(uniqueid: string, userUid: number, userId: number) {
    userUid = this.resolveTenant(userUid, userId);
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');
    if (agent.status !== 'READY') {
      throw new BadRequestException(`Agent must be READY to pick a call (current: ${agent.status})`);
    }

    const settings = await this.settingsService.getOperatorSettings(userUid, userId);
    if (!settings.pickup_enabled) {
      throw new ForbiddenException('Pickup not allowed for this operator');
    }

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.status !== 'WAITING' && call.status !== 'RINGING') {
      throw new BadRequestException(`Call is not pickable (status: ${call.status})`);
    }

    const callerChannel = call.callerChannel;
    if (!callerChannel) {
      throw new BadRequestException(
        'Caller channel not available yet — try again in a moment',
      );
    }

    const { exten: agentExten, context } = await this.resolveAgentRedirectTarget(
      userUid,
      agentInterface,
    );

    try {
      await this.amiService.action({
        action: 'Redirect',
        channel: callerChannel,
        context,
        exten: agentExten,
        priority: '1',
      });
    } catch (err: any) {
      throw new BadRequestException(`Pick call failed: ${err.message}`);
    }

    this.logger.log(
      `Agent ${agentInterface} picked call ${uniqueid} from queue ${call.queue} → ${context},${agentExten}`,
    );

    return { success: true, uniqueid, target: agentExten, context };
  }

  // ─── Missed Calls ──────────────────────────────────────

  async logMissedCall(params: {
    uniqueid: string;
    queueName: string;
    callerIdNum: string;
    callerIdName?: string;
    holdTime?: number;
    position?: number;
    userUid: number;
  }): Promise<void> {
    try {
      const [, created] = await this.missedCallModel.findOrCreate({
        where: { call_uniqueid: params.uniqueid },
        defaults: {
          call_uniqueid: params.uniqueid,
          queue_name: params.queueName,
          caller_id_num: params.callerIdNum || '',
          caller_id_name: params.callerIdName || '',
          hold_time: params.holdTime || 0,
          position: params.position || 0,
          called_back: false,
          user_uid: params.userUid,
        },
      });
      if (!created) return;

      this.stateService.emitEvent('missedCallNew', params.userUid, {
        uniqueid: params.uniqueid,
        queue: params.queueName,
        callerIdNum: params.callerIdNum,
        holdTime: params.holdTime || 0,
      });
    } catch (err: any) {
      if (err?.name === 'SequelizeUniqueConstraintError') return;
      this.logger.warn(`Failed to log missed call: ${err.message}`);
    }
  }

  async getMissedCalls(userUid: number, includeHandled = false, userId?: number) {
    const tenant =
      userId != null
        ? (this.stateService.findTenantForOnlineUser(userId) ?? userUid)
        : userUid;
    const where: any = { user_uid: tenant };
    if (!includeHandled) where.called_back = false;
    const rows = await this.missedCallModel.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    // Defensive: collapse legacy duplicates that share the same Asterisk uniqueid
    const seen = new Set<string>();
    return rows.filter((r) => {
      const id = r.call_uniqueid;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async markMissedCalled(id: number, note: string | undefined, userUid: number, userId: number) {
    const missed = await this.missedCallModel.findOne({
      where: { uid: id, user_uid: userUid },
    });
    if (!missed) throw new NotFoundException('Missed call not found');

    await missed.update({
      called_back: true,
      called_back_by: userId,
      called_back_at: new Date(),
      note: note || '',
    });

    this.stateService.emitEvent('missedCallUpdate', userUid, {
      id: missed.uid,
      called_back: true,
      called_back_by: userId,
    });

    return { success: true };
  }

  /**
   * Number-level worklist (D-16/D-19): groups the call-level cc_missed_calls
   * rows by caller_id_num + personal at the READ layer only — the table
   * itself stays call-level (findOrCreate-by-uniqueid in persistMissedCall
   * keeps UNIQUE(call_uniqueid) intact, RESEARCH Pitfall 4). Excludes rows
   * already resolved (called_back) or self-resolved (client_called_back).
   */
  async getMissedCallsGrouped(userUid: number) {
    const rows = await this.missedCallModel.findAll({
      where: { user_uid: userUid, called_back: false, client_called_back: false },
      attributes: [
        'caller_id_num',
        'personal',
        [fn('COUNT', col('uid')), 'attemptCount'],
        [fn('MAX', col('created_at')), 'lastAttemptAt'],
        [fn('MAX', col('called_back_by')), 'claimedBy'],
        [fn('MAX', col('caller_id_name')), 'callerIdName'],
        // D-19 queue-name chip for queue-missed rows — same MAX-aggregate
        // idiom as callerIdName/claimedBy above (09-10, Rule 2: the UI's
        // queue-missed chip has no data source without this).
        [fn('MAX', col('queue_name')), 'queueName'],
      ],
      group: ['caller_id_num', 'personal'],
      order: [[literal('lastAttemptAt'), 'DESC']],
      raw: true,
    });

    return (rows as any[]).map((r) => ({
      callerIdNum: r.caller_id_num,
      callerIdName: r.callerIdName || '',
      personal: !!r.personal,
      attemptCount: parseInt(r.attemptCount, 10) || 0,
      lastAttemptAt: r.lastAttemptAt,
      claimedBy: r.claimedBy ?? null,
      queueName: r.queueName || null,
    }));
  }

  /**
   * Claims a queue-missed (shared-pool) number group for the operator
   * (D-19). Personal misses are already owned by the agent whose channel
   * rang, so claim only ever targets personal=false rows. Idempotent —
   * server is source of truth on conflict, last write wins (T-09-09-03).
   */
  async claimMissedCall(userUid: number, operatorUserId: number, callerIdNum: string) {
    if (!callerIdNum) throw new BadRequestException('callerIdNum is required');

    const [claimed] = await this.missedCallModel.update(
      { called_back_by: operatorUserId },
      {
        where: {
          user_uid: userUid,
          caller_id_num: callerIdNum,
          personal: false,
          called_back: false,
          client_called_back: false,
        },
      },
    );

    this.stateService.emitEvent('missedCallUpdate', userUid, {
      callerIdNum,
      claimedBy: operatorUserId,
    });

    return { success: true, claimed };
  }

  /**
   * D-17: when the client calls back on their own and the call connects,
   * tag every open (unresolved) missed row for that number as
   * client_called_back so it drops out of the active worklist.
   */
  async autoResolveOnAnswer(userUid: number, callerIdNum: string): Promise<void> {
    if (!callerIdNum) return;
    try {
      const [affected] = await this.missedCallModel.update(
        { client_called_back: true },
        {
          where: {
            user_uid: userUid,
            caller_id_num: callerIdNum,
            called_back: false,
            client_called_back: false,
          },
        },
      );
      if (affected > 0) {
        this.stateService.emitEvent('missedCallUpdate', userUid, {
          callerIdNum,
          clientCalledBack: true,
        });
      }
    } catch (err: any) {
      this.logger.warn(`autoResolveOnAnswer failed: ${err.message}`);
    }
  }

  /**
   * D-34/D-35: unified call history across all directions (queue inbound,
   * personal, outbound, internal) for a single operator, most-recent-first.
   * `period='shift'` looks back to the operator's current open login session
   * (falls back to start-of-day if none is open); `period='day'` always uses
   * start-of-day. Tenant-scoped by vpbx_user_uid (T-09-11-03).
   */
  async getOperatorCallHistory(userUid: number, operatorUserId: number, period: 'shift' | 'day' = 'day') {
    let since = this.startOfToday();

    if (period === 'shift') {
      const session = await this.sessionModel.findOne({
        where: { user_id: operatorUserId, user_uid: userUid, logout_time: null },
        order: [['login_time', 'DESC']],
      });
      const loginTime = session?.getDataValue('login_time') as Date | undefined;
      if (loginTime) since = loginTime;
    }

    const rows = await this.queueCallModel.findAll({
      where: {
        user_uid: userUid,
        agent_user_uid: operatorUserId,
        created_at: { [Op.gte]: since },
      },
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    return rows.map((r) => ({
      uid: r.getDataValue('uid'),
      callUniqueid: r.getDataValue('call_uniqueid'),
      queueName: r.getDataValue('queue_name'),
      callerIdNum: r.getDataValue('caller_id_num'),
      callerIdName: r.getDataValue('caller_id_name'),
      direction: r.getDataValue('direction'),
      callType: r.getDataValue('call_type'),
      disposition: r.getDataValue('disposition'),
      enterTime: r.getDataValue('enter_time'),
      answerTime: r.getDataValue('answer_time'),
      endTime: r.getDataValue('end_time'),
      waitTime: r.getDataValue('wait_time'),
      talkTime: r.getDataValue('talk_time'),
    }));
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ─── Client Card (lookup by callerIdNum) ──────────────────

  /**
   * Look up a caller across the tenant's phonebooks and pull the latest
   * service-requests for that number. The result powers the operator's
   * "Client Card" sidebar so they have context the moment the call lands.
   *
   * Matching strategy:
   *   - Strip non-digits from the search number AND from each entry.
   *   - Match on the suffix (last 10 digits) so +7/8/leading-zeroes
   *     differences don't matter.
   */
  async lookupClient(rawNumber: string, userUid: number) {
    const digits = (rawNumber || '').replace(/\D/g, '');
    if (digits.length < 4) {
      return { number: rawNumber, matched: false, contacts: [], requests: [] };
    }
    const suffix = digits.slice(-10);

    // Tenant's phonebooks
    const phonebooks = await this.phonebookModel.findAll({
      where: { user_uid: userUid },
      attributes: ['uid', 'name'],
    });
    const pbUids = phonebooks.map(p => p.uid);
    const pbMap = new Map(phonebooks.map(p => [p.uid, p.name]));

    let contacts: Array<{
      phonebook_uid: number;
      phonebook_name: string;
      number: string;
      comment: string;
      vars: Record<string, string> | null;
    }> = [];

    if (pbUids.length > 0) {
      // Sequelize cannot easily strip non-digits in SQL portably,
      // so we LIKE %suffix% and then filter in JS.
      const candidates = await this.phonebookEntryModel.findAll({
        where: {
          phonebook_uid: { [Op.in]: pbUids },
          number: { [Op.like]: `%${suffix.slice(-7)}%` }, // last 7 digits for the LIKE filter
        },
        limit: 50,
      });
      contacts = candidates
        .filter(e => e.number.replace(/\D/g, '').endsWith(suffix))
        .map(e => ({
          phonebook_uid: e.phonebook_uid,
          phonebook_name: pbMap.get(e.phonebook_uid) || '',
          number: e.number,
          comment: e.comment || '',
          vars: e.vars,
        }));
    }

    // Recent service requests for this number
    const requests = await this.serviceRequestModel.findAll({
      where: {
        user_uid: userUid,
        phone: { [Op.like]: `%${suffix.slice(-7)}%` },
      },
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: [
        'uid', 'request_number', 'counterparty_name', 'phone',
        'topic', 'comment', 'address', 'request_status',
        'scheduled_date', 'created_at',
      ],
    });

    return {
      number: rawNumber,
      matched: contacts.length > 0 || requests.length > 0,
      contacts,
      requests: requests
        .map(r => r.get({ plain: true }))
        .filter((r: any) => (r.phone || '').replace(/\D/g, '').endsWith(suffix)),
    };
  }

  // ─── Transfer Directory (D-36) ────────────────────────────

  /**
   * Unified transfer directory (D-36): internal endpoints (with extension +
   * live presence from the Task-2 CallCenterPresenceService, falling back to
   * CC agent status when the endpoint is a logged-in agent), queues (free
   * count reused from the existing CC-state aggregation — recalcQueueStats'
   * agents.available), and call groups (free count derived by matching each
   * member extension against the live CC agent map). Tenant-scoped by
   * vpbx_user_uid throughout (T-09-11-01).
   */
  async getTransferDirectory(userUid: number, search?: string) {
    const agents = this.stateService.getAllAgents(userUid);
    const agentByExtension = new Map<string, (typeof agents)[number]>();
    for (const agent of agents) {
      agentByExtension.set(interfaceToExtension(agent.interface), agent);
    }

    const endpointRows = await this.endpointModel.findAll({
      where: { tenantid: String(userUid) },
      attributes: ['id', 'department'],
    });
    const endpoints = endpointRows
      .filter((ep) => !isWebrtcCompanion(ep.id))
      .map((ep) => {
        const extension = extractExtension(ep.id);
        const agent = agentByExtension.get(extension);
        return {
          type: 'endpoint' as const,
          id: ep.id,
          extension,
          label: ep.department || extension,
          presence: this.presenceService.getPresence(userUid, extension) || agent?.status || 'OFFLINE',
        };
      });

    const queueRows = await this.queueModel.findAll({
      where: { user_uid: userUid },
      attributes: ['name', 'display_name'],
    });
    const queues = queueRows.map((q) => {
      const name = q.getDataValue('name') as string;
      const liveQueue = this.stateService.getQueue(userUid, name);
      return {
        type: 'queue' as const,
        id: name,
        label: (q.getDataValue('display_name') as string) || name,
        freeOperators: liveQueue?.agents.available ?? 0,
        totalOperators: liveQueue?.agents.total ?? 0,
      };
    });

    const groupRows = await this.callGroupModel.findAll({
      where: { user_uid: userUid },
      attributes: ['uid', 'name'],
    });
    const groupIds = groupRows.map((g) => g.getDataValue('uid') as number);
    const members = groupIds.length
      ? await this.callGroupMemberModel.findAll({
          where: { call_group_uid: { [Op.in]: groupIds }, member_type: 'internal' },
          attributes: ['call_group_uid', 'value'],
        })
      : [];
    const membersByGroup = new Map<number, string[]>();
    for (const m of members) {
      const groupUid = m.getDataValue('call_group_uid') as number;
      const list = membersByGroup.get(groupUid) || [];
      list.push(m.getDataValue('value') as string);
      membersByGroup.set(groupUid, list);
    }

    const groups = groupRows.map((g) => {
      const uid = g.getDataValue('uid') as number;
      const extensions = membersByGroup.get(uid) || [];
      const freeOperators = extensions.filter((ext) => agentByExtension.get(ext)?.status === 'READY').length;
      return {
        type: 'group' as const,
        id: String(uid),
        label: g.getDataValue('name') as string,
        freeOperators,
        totalOperators: extensions.length,
      };
    });

    if (!search) return { endpoints, queues, groups };

    const term = search.toLowerCase();
    return {
      endpoints: endpoints.filter(
        (e) => e.extension.toLowerCase().includes(term) || e.label.toLowerCase().includes(term),
      ),
      queues: queues.filter((q) => q.id.toLowerCase().includes(term) || q.label.toLowerCase().includes(term)),
      groups: groups.filter((g) => g.label.toLowerCase().includes(term)),
    };
  }
}
