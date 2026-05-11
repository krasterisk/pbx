/**
 * CallCenter Business Logic Service.
 *
 * Implements agent/supervisor actions by calling AMI commands
 * and updating the in-memory state store.
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CcPauseReason } from './models/pause-reason.model';
import { CcAgentSession } from './models/agent-session.model';
import { CcMissedCall } from './models/missed-call.model';
import { TransferDto } from './dto/callcenter.dto';
import { User } from '../users/user.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { ServiceRequest } from '../service-requests/service-request.model';
import { Op } from 'sequelize';

@Injectable()
export class CallCenterService {
  private readonly logger = new Logger(CallCenterService.name);

  /** Maps userId → active session uid */
  private readonly activeSessions = new Map<string, number>();

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly ccAmiService: CallCenterAmiService,
    @InjectModel(CcPauseReason) private readonly pauseReasonModel: typeof CcPauseReason,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PhonebookEntry) private readonly phonebookEntryModel: typeof PhonebookEntry,
    @InjectModel(RoutePhonebook) private readonly phonebookModel: typeof RoutePhonebook,
    @InjectModel(ServiceRequest) private readonly serviceRequestModel: typeof ServiceRequest,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────

  private sessionKey(userUid: number, userId: number): string {
    return `${userUid}:${userId}`;
  }

  private async resolveAgentInterface(userUid: number, userId: number): Promise<string | null> {
    const agents = this.stateService.getAllAgents(userUid);
    const agent = agents.find(a => a.userId === userId);
    return agent?.interface || null;
  }

  // ─── Agent Actions ──────────────────────────────────────

  async agentLogin(agentInterface: string, queues: string[], userUid: number, userId: number) {
    // Create a session record
    const session = await this.sessionModel.create({
      user_id: userId,
      agent_interface: agentInterface,
      login_time: new Date(),
      user_uid: userUid,
    });
    this.activeSessions.set(this.sessionKey(userUid, userId), session.uid);

    // Get user display name
    let displayName = agentInterface;
    try {
      const user = await this.userModel.findOne({ where: { id: userId, vpbx_user_uid: userUid } });
      if (user) displayName = user.getDataValue('name') || user.getDataValue('login') || agentInterface;
    } catch { /* ignore */ }

    // Add agent to queues via AMI
    for (const queue of queues) {
      try {
        await this.amiService.queueAdd(queue, agentInterface);
      } catch (err: any) {
        this.logger.warn(`Failed to add ${agentInterface} to queue ${queue}: ${err.message}`);
      }
    }

    // Update in-memory state
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      name: displayName,
      queues,
      loginTime: new Date(),
      callsTaken: 0,
      userId,
    });

    // Log event
    await this.ccAmiService.logAgentEvent({
      sessionId: session.uid,
      userId,
      eventType: 'LOGIN',
      userUid,
    });

    this.logger.log(`Agent ${displayName} (${agentInterface}) logged in, queues: [${queues.join(', ')}]`);
    return { success: true, sessionId: session.uid };
  }

  async agentLogout(userUid: number, userId: number) {
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');

    // Remove from all queues via AMI
    for (const queue of agent.queues) {
      try {
        await this.amiService.queueRemove(queue, agentInterface);
      } catch (err: any) {
        this.logger.warn(`Failed to remove ${agentInterface} from queue ${queue}: ${err.message}`);
      }
    }

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

    // Log event
    const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
    if (sessionId) {
      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'PAUSE',
        reason: reason || '',
        userUid,
      });
    }

    return { success: true };
  }

  async agentUnpause(userUid: number, userId: number, queue?: string) {
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
      pauseReason: undefined,
    });

    const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
    if (sessionId) {
      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'READY',
        userUid,
      });
    }

    return { success: true };
  }

  async agentHangup(userUid: number, userId: number, channel?: string) {
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
      // Hangup via AMI — the AgentComplete event will clean up state
      try {
        await this.amiService.hangup(agentInterface);
      } catch (err: any) {
        this.logger.warn(`Hangup failed for ${agentInterface}: ${err.message}`);
      }
    }

    return { success: true };
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
    if (!this.amiService.isConnected()) {
      throw new BadRequestException('AMI not connected');
    }

    // For blind transfer, use AMI Redirect
    if (dto.type === 'blind') {
      const call = this.stateService.getCall(dto.uniqueid);
      if (!call) throw new NotFoundException('Call not found');

      // Redirect the caller's channel to the target extension
      try {
        await this.amiService.action({
          action: 'Redirect',
          channel: call.callerIdNum, // This should be the actual channel name
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
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    // Cancel auto-timeout timer if pending
    this.ccAmiService.cancelWrapupTimer(userUid, agentInterface);

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      currentCall: undefined,
    });

    this.stateService.emitEvent('wrapupEnd', userUid, { agent: agentInterface });

    const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
    if (sessionId) {
      await this.ccAmiService.logAgentEvent({
        sessionId,
        userId,
        eventType: 'WRAPUP_END',
        userUid,
      });
    }

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
    const supervisor = await this.userModel.findOne({ where: { id: supervisorId, vpbx_user_uid: userUid } });
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

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'READY',
      pauseReason: undefined,
    });

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

  // ─── Pick Call ──────────────────────────────────────────
  //
  // Pick Call: agent manually grabs a waiting caller from a queue.
  // Implemented as AMI Redirect of the caller channel to the agent's
  // extension via the `from-internal` context, bypassing queue strategy.
  // The subsequent AgentConnect AMI event normally updates state, but we
  // also pre-update state optimistically so the SSE event is instant.

  async agentPickCall(uniqueid: string, userUid: number, userId: number) {
    const agentInterface = await this.resolveAgentInterface(userUid, userId);
    if (!agentInterface) throw new NotFoundException('Agent not logged in');

    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent) throw new NotFoundException('Agent state not found');
    if (agent.status !== 'READY') {
      throw new BadRequestException(`Agent must be READY to pick a call (current: ${agent.status})`);
    }

    const call = this.stateService.getCall(uniqueid);
    if (!call) throw new NotFoundException('Call not found');
    if (call.userUid !== userUid) {
      throw new BadRequestException('Call belongs to another tenant');
    }
    if (call.status !== 'WAITING' && call.status !== 'RINGING') {
      throw new BadRequestException(`Call is not pickable (status: ${call.status})`);
    }

    // The caller's actual channel might not be tracked yet (we only learn it on AgentConnect),
    // so we redirect using the well-known QueueCallerJoin channel pattern.
    // The "channel" recorded on a waiting call is the caller's channel from QueueCallerJoin
    // (we store it as `callerChannel` once available; fall back to the call uniqueid + queue context).
    const callerChannel = call.callerChannel;
    if (!callerChannel) {
      throw new BadRequestException(
        'Caller channel not available yet — try again in a moment',
      );
    }

    const agentExten = agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');

    try {
      await this.amiService.action({
        action: 'Redirect',
        channel: callerChannel,
        context: 'from-internal',
        exten: agentExten,
        priority: '1',
      });
    } catch (err: any) {
      throw new BadRequestException(`Pick call failed: ${err.message}`);
    }

    this.logger.log(
      `Agent ${agentInterface} picked call ${uniqueid} from queue ${call.queue}`,
    );

    return { success: true, uniqueid, target: agentExten };
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
      await this.missedCallModel.create({
        call_uniqueid: params.uniqueid,
        queue_name: params.queueName,
        caller_id_num: params.callerIdNum || '',
        caller_id_name: params.callerIdName || '',
        hold_time: params.holdTime || 0,
        position: params.position || 0,
        called_back: false,
        user_uid: params.userUid,
      });

      this.stateService.emitEvent('missedCallNew', params.userUid, {
        uniqueid: params.uniqueid,
        queue: params.queueName,
        callerIdNum: params.callerIdNum,
        holdTime: params.holdTime || 0,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log missed call: ${err.message}`);
    }
  }

  async getMissedCalls(userUid: number, includeHandled = false) {
    const where: any = { user_uid: userUid };
    if (!includeHandled) where.called_back = false;
    return this.missedCallModel.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 200,
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
}
