import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction } from 'sequelize';
import type { AutodialDisposition, IAutodialRetryConfig } from '@krasterisk/shared';
import { AcAttempt } from './models/ac-attempt.model';
import { AcTask } from './models/ac-task.model';
import { AcCampaign } from './models/ac-campaign.model';
import { decideRetry } from './autodial-disposition.util';
import { isAbandonedOutcome } from './autodial-predictive.util';
import { AutodialStateService } from './autodial-state.service';
import { normalizeAutodialPhone } from './autodial-phone.util';
import { AutodialWebhooksService } from './autodial-webhooks.service';

export interface FinalizeAttemptInput {
  attemptUid: number;
  disposition: AutodialDisposition;
  hangupCause?: string | null;
  billsec?: number;
  duration?: number;
  answeredAt?: Date | null;
  amdResult?: string | null;
  queueName?: string | null;
  agentInterface?: string | null;
  talkSec?: number;
  uniqueid?: string | null;
  linkedid?: string | null;
  scenarioResult?: Record<string, unknown> | null;
}

/**
 * Owns the write side of an attempt: opening a row before the channel exists,
 * then closing it and scheduling (or not) the next try.
 */
@Injectable()
export class AutodialAttemptService {
  private readonly logger = new Logger(AutodialAttemptService.name);

  constructor(
    @InjectModel(AcAttempt) private readonly attemptModel: typeof AcAttempt,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    private readonly state: AutodialStateService,
    @Optional() private readonly webhooks?: AutodialWebhooksService,
  ) {}

  /**
   * Persisted before the ARI call so a crash between origination and the first
   * event still leaves a row the reconciler can close.
   */
  async nextAttemptNo(taskUid: number): Promise<number> {
    const maxNo = await this.attemptModel.max('attempt_no', { where: { task_uid: taskUid } });
    return (Number(maxNo) || 0) + 1;
  }

  /**
   * Persisted before the ARI call so a crash between origination and the first
   * event still leaves a row the reconciler can close.
   */
  async openAttempt(params: {
    tourNo?: number;
    userUid: number;
    taskUid: number;
    campaignUid: number;
    attemptNo: number;
    channelId: string;
    trunkId: string;
    callerId: string | null;
  }): Promise<AcAttempt> {
    return this.attemptModel.create({
      user_uid: params.userUid,
      task_uid: params.taskUid,
      campaign_uid: params.campaignUid,
      attempt_no: params.attemptNo,
      tour_no: params.tourNo ?? 1,
      started_at: new Date(),
      disposition: 'dialing',
      channel_id: params.channelId,
      trunk_id: params.trunkId,
      caller_id: params.callerId,
    });
  }

  /**
   * Close the attempt and re-arm or retire the task. Idempotent: a second call
   * for an already-closed attempt is ignored, because ARI ChannelDestroyed and
   * the dialplan hangup handler both report the same call.
   */
  async finalize(input: FinalizeAttemptInput): Promise<AutodialDisposition | null> {
    return this.withTaskLock(input.attemptUid, (transaction) => this.finalizeLocked(input, transaction));
  }

  private async withTaskLock<T>(attemptUid: number, callback: (transaction?: Transaction) => Promise<T>): Promise<T> {
    const db = this.attemptModel.sequelize;
    if (!db) return callback(); // Model-only unit fixtures; runtime models always have a connection.
    return db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const attempt = await this.attemptModel.findByPk(attemptUid, { transaction });
      if (attempt) await this.taskModel.findByPk(attempt.task_uid, { transaction, lock: transaction.LOCK.UPDATE });
      return callback(transaction);
    });
  }

  private async finalizeLocked(input: FinalizeAttemptInput, transaction?: Transaction): Promise<AutodialDisposition | null> {
    const attempt = await this.attemptModel.findByPk(input.attemptUid, transaction ? { transaction, lock: transaction.LOCK.UPDATE } : undefined);
    if (!attempt) {
      this.logger.warn(`finalize: attempt ${input.attemptUid} not found`);
      return null;
    }
    const now = new Date();
    const disposition: AutodialDisposition =
      attempt.amd_result === 'VOICEMAIL'
        ? 'voicemail'
        : attempt.amd_result === 'MACHINE'
          ? 'amd_machine'
          : input.disposition;
    const patch: Partial<AcAttempt> = {
      ended_at: now,
      disposition,
      duration: input.duration ?? Math.round((now.getTime() - attempt.started_at.getTime()) / 1000),
    };
    if (input.answeredAt !== undefined) patch.answered_at = input.answeredAt;
    if (input.hangupCause !== undefined) patch.hangup_cause = input.hangupCause;
    // Once the dialplan has reported CDR facts, ARI's rounded wall time is only
    // a fallback. Callback-first and callback-last must produce the same value.
    if (input.billsec !== undefined && attempt.scenario_result == null) patch.billsec = input.billsec;
    if (input.amdResult !== undefined) patch.amd_result = input.amdResult;
    if (input.queueName !== undefined) patch.queue_name = input.queueName;
    if (input.agentInterface !== undefined) patch.agent_interface = input.agentInterface;
    if (input.talkSec !== undefined) patch.talk_sec = input.talkSec;
    if (input.uniqueid !== undefined) patch.uniqueid = input.uniqueid;
    if (input.linkedid !== undefined) patch.linkedid = input.linkedid;
    if (input.scenarioResult !== undefined) patch.scenario_result = input.scenarioResult;

    // ARI destroy and the dialplan hangup handler can race. Only the request
    // that atomically moves `dialing` to a terminal disposition advances task.
    const [updated] = await this.attemptModel.update(patch, {
      where: { uid: attempt.uid, disposition: 'dialing' },
      ...(transaction ? { transaction } : {}),
    });
    if (!updated) return (await this.attemptModel.findByPk(attempt.uid))?.disposition ?? null;

    this.recordPredictiveOutcome(attempt, { ...input, disposition });
    if (transaction) await this.advanceTask(attempt.task_uid, disposition, input.hangupCause ?? null, transaction);
    else await this.advanceTask(attempt.task_uid, disposition, input.hangupCause ?? null);
    if (transaction) await this.webhooks?.enqueueAttempt(attempt.user_uid, attempt.uid, transaction);
    return disposition;
  }

  /**
   * Mark a confirmed AMD machine result while the channel is still alive. The
   * machine dialplan tail invokes this before Hangup so the ARI finalizer can
   * atomically retain the correct terminal disposition.
   * `outcome=voicemail` means the leave-message prompt was entered; hangup
   * (default) means the call ends without playing a message.
   */
  async markAmdMachine(
    attemptUid: number,
    outcome: 'hangup' | 'voicemail' = 'hangup',
  ): Promise<void> {
    if (this.attemptModel.sequelize) {
      await this.withTaskLock(attemptUid, async (transaction) => {
        const attempt = await this.attemptModel.findByPk(attemptUid, { transaction, lock: transaction!.LOCK.UPDATE });
        if (!attempt) return;
        const disposition = outcome === 'voicemail' ? 'voicemail' : 'amd_machine';
        await attempt.update({ amd_result: outcome === 'voicemail' ? 'VOICEMAIL' : 'MACHINE',
          ...(attempt.disposition === 'dialing' ? {} : { disposition }) }, { transaction });
        if (attempt.disposition === 'dialing') return;
        const latest = await this.attemptModel.max('uid', { where: { task_uid: attempt.task_uid }, transaction });
        const task = await this.taskModel.findByPk(attempt.task_uid, { transaction });
        if (Number(latest) === attempt.uid && task && task.status !== 'cancelled')
          await this.advanceTask(attempt.task_uid, disposition, attempt.hangup_cause, transaction);
        await this.webhooks?.enqueueAttempt(attempt.user_uid, attempt.uid, transaction!);
      });
      return;
    }
    await this.attemptModel.update(
      { amd_result: outcome === 'voicemail' ? 'VOICEMAIL' : 'MACHINE' },
      { where: { uid: attemptUid, disposition: 'dialing' } },
    );
  }

  /** Persist answer evidence so a replacement worker can classify Destroy. */
  async markAnswered(channelId: string, answeredAt: Date): Promise<void> {
    await this.attemptModel.update(
      { answered_at: answeredAt },
      { where: { channel_id: channelId, disposition: 'dialing', answered_at: null } },
    );
  }

  async findOpenByChannelId(channelId: string): Promise<AcAttempt | null> {
    return this.attemptModel.findOne({
      where: { channel_id: channelId, disposition: 'dialing' },
    });
  }

  /**
   * Atomically fence a leased task before ARI receives an originate request.
   * A competing worker can only proceed when it still owns `leased_by`; the
   * attempt and the `dialing` state are committed together, so a crash cannot
   * leave either a live attempt without a task transition or vice versa.
   */
  async claimAndOpenAttempt(params: {
    tourNo?: number;
    userUid: number;
    taskUid: number;
    campaignUid: number;
    attemptNo: number;
    cycleAttempt?: number;
    channelId: string;
    trunkId: string;
    callerId: string | null;
    leaseId: string;
    normalizedPhone?: string;
    gate?: () => Promise<'ok' | 'dnc'>;
  }): Promise<AcAttempt | null> {
    const sequelize = this.taskModel.sequelize;
    if (!sequelize) throw new Error('Autodial task model is not connected to Sequelize');

    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction) => {
      if (params.normalizedPhone) {
        // Every campaign/worker for a tenant locks the same existing phone row.
        // No process-local mutex and no policy that forbids legitimate duplicate contacts.
        const replacements = { userUid: params.userUid, phone: normalizeAutodialPhone(params.normalizedPhone) };
        const anchors = await sequelize.query<{ uid: number }>(`
          SELECT p.uid FROM ac_contact_phones p JOIN ac_contacts c ON c.uid = p.contact_uid
          WHERE c.vpbx_user_uid = :userUid AND p.canonical_phone = :phone ORDER BY p.uid LIMIT 1`,
        { replacements, transaction, type: QueryTypes.SELECT });
        if (!anchors.length) return null;
        const locked = await sequelize.query<{ uid: number }>(
          'SELECT uid FROM ac_contact_phones WHERE uid = :uid FOR UPDATE',
          { replacements: { uid: anchors[0].uid }, transaction, type: QueryTypes.SELECT },
        );
        if (!locked.length) return null;
        const active = await sequelize.query<{ uid: number }>(`
          SELECT a.uid FROM ac_attempts a JOIN ac_tasks t ON t.uid = a.task_uid
          JOIN ac_contact_phones p ON p.uid = t.phone_uid
          WHERE a.vpbx_user_uid = :userUid AND p.canonical_phone = :phone
            AND a.disposition = 'dialing' LIMIT 1`,
        { replacements, transaction, type: QueryTypes.SELECT });
        if (active.length) return null;
      }
      const [claimed] = await this.taskModel.update(
        {
          status: 'dialing',
          attempt_count: params.cycleAttempt ?? params.attemptNo,
          last_disposition: 'dialing',
        },
        {
          where: {
            uid: params.taskUid,
            user_uid: params.userUid,
            status: 'leased',
            leased_by: params.leaseId,
          },
          transaction,
        },
      );
      if (!claimed) return null;

      if (params.gate && (await params.gate()) === 'dnc') {
        await this.taskModel.update(
          {
            status: 'completed',
            last_disposition: 'dnc',
            last_cause: 'blocked by dnc',
            leased_by: null,
            leased_at: null,
          },
          { where: { uid: params.taskUid, user_uid: params.userUid }, transaction },
        );
        return null;
      }

      return this.attemptModel.create({
        user_uid: params.userUid,
        task_uid: params.taskUid,
        campaign_uid: params.campaignUid,
        attempt_no: params.attemptNo,
        tour_no: params.tourNo ?? 1,
        started_at: new Date(),
        disposition: 'dialing',
        channel_id: params.channelId,
        trunk_id: params.trunkId,
        caller_id: params.callerId,
      }, { transaction });
    });
  }

  /**
   * Feed the predictive controller. The hangup handler normally reports the
   * answering agent before ARI destroys the channel, but if that report is
   * late the call counts as abandoned — a bias that slows dialing down rather
   * than speeding it up, which is the safe direction for abandon rate.
   */
  private recordPredictiveOutcome(attempt: AcAttempt, input: FinalizeAttemptInput): void {
    const answered = Boolean(input.answeredAt ?? attempt.answered_at);
    if (!answered) return;
    const abandoned = isAbandonedOutcome({
      answered,
      agentInterface: input.agentInterface ?? attempt.agent_interface,
      disposition: input.disposition,
    });
    this.state.recordAnsweredOutcome(attempt.campaign_uid, abandoned);
  }

  /** Enrich an attempt with post-answer data reported by the dialplan. */
  async applyScenarioResult(
    attemptUid: number,
    data: {
      amdResult?: string | null;
      queueName?: string | null;
      agentInterface?: string | null;
      billsec?: number;
      talkSec?: number;
      uniqueid?: string | null;
      linkedid?: string | null;
      scenarioResult?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await this.withTaskLock(attemptUid, async (transaction) => {
    const attempt = await this.attemptModel.findByPk(attemptUid, transaction ? { transaction, lock: transaction.LOCK.UPDATE } : undefined);
    if (!attempt) return;
    await attempt.update({
      amd_result: attempt.amd_result === 'VOICEMAIL' ? 'VOICEMAIL' : data.amdResult ?? attempt.amd_result,
      queue_name: data.queueName ?? attempt.queue_name,
      agent_interface: data.agentInterface ?? attempt.agent_interface,
      billsec: data.billsec ?? attempt.billsec,
      talk_sec: data.talkSec ?? attempt.talk_sec,
      uniqueid: data.uniqueid ?? attempt.uniqueid,
      linkedid: data.linkedid ?? attempt.linkedid,
      scenario_result: data.scenarioResult ?? attempt.scenario_result,
    }, transaction ? { transaction } : undefined);
    if (transaction && attempt.ended_at) await this.webhooks?.enqueueAttempt(attempt.user_uid, attempt.uid, transaction);
    });
  }

  private async advanceTask(
    taskUid: number,
    disposition: AutodialDisposition,
    cause: string | null,
    transaction?: Transaction,
  ): Promise<void> {
    const task = await this.taskModel.findByPk(taskUid, transaction ? { transaction } : undefined);
    if (!task) return;

    const retryConfig = await this.retryConfigFor(task.campaign_uid, transaction);
    const decision = decideRetry({
      disposition,
      attemptCount: task.attempt_count,
      retry: retryConfig,
      now: new Date(),
    });

    await task.update({
      status: decision.retry ? 'pending' : 'completed',
      last_disposition: decision.disposition,
      last_cause: cause,
      next_attempt_at: decision.nextAttemptAt ?? null,
      leased_by: null,
      leased_at: null,
    }, transaction ? { transaction } : undefined);
  }

  private async retryConfigFor(campaignUid: number, transaction?: Transaction): Promise<IAutodialRetryConfig> {
    const campaign = await this.campaignModel.findByPk(campaignUid, { attributes: ['retry'], ...(transaction ? { transaction } : {}) });
    return (
      campaign?.retry ?? { max_attempts: 3, default_interval_sec: 3600, intervals_sec: {} }
    );
  }

  /** Attempts still marked `dialing` past the cutoff — a crash or a lost event. */
  async findStaleAttempts(olderThan: Date): Promise<AcAttempt[]> {
    return this.attemptModel.findAll({
      where: { disposition: 'dialing', started_at: { [Op.lt]: olderThan } },
      limit: 500,
    });
  }
}
