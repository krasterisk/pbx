import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { AutodialDisposition, IAutodialRetryConfig } from '@krasterisk/shared';
import { AcAttempt } from './models/ac-attempt.model';
import { AcTask } from './models/ac-task.model';
import { AcCampaign } from './models/ac-campaign.model';
import { decideRetry } from './autodial-disposition.util';
import { isAbandonedOutcome } from './autodial-predictive.util';
import { AutodialStateService } from './autodial-state.service';

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
  ) {}

  /**
   * Persisted before the ARI call so a crash between origination and the first
   * event still leaves a row the reconciler can close.
   */
  async openAttempt(params: {
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
  async finalize(input: FinalizeAttemptInput): Promise<void> {
    const attempt = await this.attemptModel.findByPk(input.attemptUid);
    if (!attempt) {
      this.logger.warn(`finalize: attempt ${input.attemptUid} not found`);
      return;
    }
    if (attempt.disposition !== 'dialing') return;

    const now = new Date();
    await attempt.update({
      ended_at: now,
      answered_at: input.answeredAt ?? attempt.answered_at,
      disposition: input.disposition,
      hangup_cause: input.hangupCause ?? null,
      billsec: input.billsec ?? 0,
      duration: input.duration ?? Math.round((now.getTime() - attempt.started_at.getTime()) / 1000),
      amd_result: input.amdResult ?? null,
      queue_name: input.queueName ?? null,
      agent_interface: input.agentInterface ?? null,
      talk_sec: input.talkSec ?? input.billsec ?? 0,
      uniqueid: input.uniqueid ?? null,
      linkedid: input.linkedid ?? null,
      scenario_result: input.scenarioResult ?? null,
    });

    this.recordPredictiveOutcome(attempt, input);
    await this.advanceTask(attempt.task_uid, input.disposition, input.hangupCause ?? null);
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
    const attempt = await this.attemptModel.findByPk(attemptUid);
    if (!attempt) return;
    await attempt.update({
      amd_result: data.amdResult ?? attempt.amd_result,
      queue_name: data.queueName ?? attempt.queue_name,
      agent_interface: data.agentInterface ?? attempt.agent_interface,
      billsec: data.billsec ?? attempt.billsec,
      talk_sec: data.talkSec ?? attempt.talk_sec,
      uniqueid: data.uniqueid ?? attempt.uniqueid,
      linkedid: data.linkedid ?? attempt.linkedid,
      scenario_result: data.scenarioResult ?? attempt.scenario_result,
    });
  }

  private async advanceTask(
    taskUid: number,
    disposition: AutodialDisposition,
    cause: string | null,
  ): Promise<void> {
    const task = await this.taskModel.findByPk(taskUid);
    if (!task) return;

    const retryConfig = await this.retryConfigFor(task.campaign_uid);
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
    });
  }

  private async retryConfigFor(campaignUid: number): Promise<IAutodialRetryConfig> {
    const campaign = await this.campaignModel.findByPk(campaignUid, { attributes: ['retry'] });
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
