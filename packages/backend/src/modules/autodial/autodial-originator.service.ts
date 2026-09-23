import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import type { IAutodialSchedule } from '@krasterisk/shared';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { DirectoriesService } from '../directories/directories.service';
import { AcCampaign } from './models/ac-campaign.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcTask } from './models/ac-task.model';
import { AutodialAttemptService } from './autodial-attempt.service';
import { AutodialDncService } from './autodial-dnc.service';
import { AutodialStateService } from './autodial-state.service';
import { buildAutodialChannelId, parseAutodialChannelId } from './autodial-phone.util';
import { autodialCampaignContextName } from './autodial-dialplan.util';
import { selectAutodialTrunkLegs, type AutodialDialTarget } from './autodial-trunk.util';
import { autodialContactVariables } from './autodial-contact-variables.util';
import {
  dispositionFromAnsweredCall,
  dispositionFromHangupCause,
} from './autodial-disposition.util';
import { subscriberHoursAllowForSchedules } from './autodial-schedule.util';

const SUBSCRIBER_HOURS_RETRY_MS = 15 * 60 * 1000;

interface AriChannelEvent {
  channel?: { id?: string; state?: string; name?: string };
  cause?: number;
  cause_txt?: string;
}

/**
 * Originates calls over ARI and turns ARI channel events into dispositions.
 *
 * The channel id is ours (`ac-{campaign}-{task}-{attempt}`), which is the whole
 * reason for choosing ARI over AMI Originate: correlation needs no guessing.
 */
@Injectable()
export class AutodialOriginatorService {
  private readonly logger = new Logger(AutodialOriginatorService.name);
  /** channelId → attempt uid, so events do not need a DB round trip */
  private readonly attemptByChannel = new Map<string, number>();
  /** A channel may surface both StasisStart and ChannelStateChange(Up). */
  private readonly handedOffChannels = new Set<string>();

  constructor(
    private readonly ari: AriHttpClientService,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcContact) private readonly contactModel: typeof AcContact,
    @InjectModel(AcContactPhone) private readonly phoneModel: typeof AcContactPhone,
    @InjectModel(AcBaseField) private readonly fieldModel: typeof AcBaseField,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    private readonly attempts: AutodialAttemptService,
    private readonly dnc: AutodialDncService,
    private readonly directories: DirectoriesService,
    private readonly state: AutodialStateService,
  ) {}

  /**
   * Dial one leased task. Returns false when the task could not be dialed at
   * all, so the pacer can release the reservation immediately.
   */
  async originate(
    task: AcTask,
    campaign: AcCampaign,
    allowedTrunkIds?: ReadonlySet<string>,
    leaseId?: string,
    schedules: IAutodialSchedule[] = [],
  ): Promise<boolean> {
    const phone = await this.phoneModel.findOne({
      where: { uid: task.phone_uid, base_uid: campaign.base_uid },
    });
    if (!phone?.normalized) {
      await this.failTask(task, 'invalid_number', 'no normalized phone');
      return false;
    }

    const tzOffset = phone.tz_offset_min ?? 180;
    if (!subscriberHoursAllowForSchedules(tzOffset, new Date(), schedules)) {
      await this.deferTask(task, 'subscriber_hours');
      return false;
    }

    // Tasks can have been generated before an operator adds this number to DNC.
    // Re-check immediately before creating an attempt; calls already handed to
    // ARI are deliberately not interrupted by a later DNC change.
    if (
      await this.dnc.isBlocked(campaign.user_uid, phone.normalized, {
        campaignUid: campaign.uid,
        baseUid: campaign.base_uid,
      })
    ) {
      await this.failTask(task, 'dnc', 'blocked by dnc');
      return false;
    }

    const legs = selectAutodialTrunkLegs(
      campaign.trunk_pool,
      campaign.cid_policy,
      phone.normalized,
      task.uid + task.attempt_count,
      allowedTrunkIds,
    );
    if (!legs.length) {
      const hasConfiguredTrunk = (campaign.trunk_pool ?? []).some((trunk) => !!trunk.trunk_id);
      if (hasConfiguredTrunk) {
        // Saturated or filtered-out trunks are capacity, not a bad contact.
        await this.deferTask(task, 'no trunk in pool');
        return false;
      }
      await this.failTask(task, 'failed', 'no trunk in pool');
      return false;
    }

    const { variables, contactValues } = await this.buildChannelVariables(
      task,
      campaign,
      phone.normalized,
    );
    const first = legs[0];
    const callerId = await this.resolveCallerId(first, campaign, contactValues);

    // A pacer can lose a stale lease while it is resolving DNC, directories or
    // caller ID. Re-check ownership immediately before opening the call. This
    // is deliberately conditional: another worker may now own the task.
    // Skip the in-memory check when leased_by is empty — leaseTasks may not
    // have stamped the instance, and claimAndOpenAttempt is the real fence.
    if (leaseId && task.leased_by && task.leased_by !== leaseId) return false;

    const cycleAttempt = task.attempt_count + 1;
    const attemptNo = Math.max(cycleAttempt, await this.attempts.nextAttemptNo(task.uid));
    const channelId = buildAutodialChannelId(campaign.uid, task.uid, attemptNo);
    const attemptInput = {
      userUid: campaign.user_uid,
      taskUid: task.uid,
      campaignUid: campaign.uid,
      attemptNo,
      channelId,
      trunkId: first.trunkId,
      callerId,
    };
    const dncGate = async (): Promise<'ok' | 'dnc'> =>
      (await this.dnc.isBlocked(campaign.user_uid, phone.normalized, {
        campaignUid: campaign.uid,
        baseUid: campaign.base_uid,
      }))
        ? 'dnc'
        : 'ok';
    const attempt = leaseId
      ? await this.attempts.claimAndOpenAttempt({
        ...attemptInput,
        leaseId,
        cycleAttempt,
        gate: dncGate,
      })
      : await this.attempts.openAttempt(attemptInput);
    if (!attempt) return false;

    if (!leaseId) {
      await task.update({ status: 'dialing', attempt_count: cycleAttempt, last_disposition: 'dialing' });
    }

    return this.originateLegs({
      legs,
      campaign,
      task,
      attempt,
      attemptNo,
      baseChannelId: channelId,
      variables,
      contactValues,
      number: phone.normalized,
      initialCallerId: callerId,
    });
  }

  /**
   * Technical originate failures may try the next eligible trunk inside this
   * attempt. Busy/no_answer stay with retry policy and never enter this loop.
   */
  private async originateLegs(input: {
    legs: AutodialDialTarget[];
    campaign: AcCampaign;
    task: AcTask;
    attempt: { uid: number; update?: (patch: Record<string, unknown>) => Promise<unknown> };
    attemptNo: number;
    baseChannelId: string;
    variables: Record<string, string>;
    contactValues: Record<string, string | number | boolean>;
    number: string;
    initialCallerId: string | null;
  }): Promise<boolean> {
    let lastError = 'no trunk in pool';
    for (let index = 0; index < input.legs.length; index += 1) {
      const target = input.legs[index];
      const channelId = index === 0 ? input.baseChannelId : `${input.baseChannelId}f${index}`;
      const callerId = index === 0
        ? input.initialCallerId
        : await this.resolveCallerId(target, input.campaign, input.contactValues);
      if (index > 0) {
        await input.attempt.update?.({
          channel_id: channelId,
          trunk_id: target.trunkId,
          caller_id: callerId,
        });
      }

      this.attemptByChannel.set(channelId, input.attempt.uid);
      this.state.addChannel({
        channelId,
        campaignUid: input.campaign.uid,
        taskUid: input.task.uid,
        attemptUid: input.attempt.uid,
        attemptNo: input.attemptNo,
        userUid: input.campaign.user_uid,
        number: input.number,
        trunkId: target.trunkId,
        startedAt: Date.now(),
        answeredAt: null,
      });

      try {
        await this.ari.originateChannel({
          endpoint: target.endpoint,
          app: this.ari.getAutodialAppName(),
          appArgs: `autodial-v1,${input.campaign.uid},${input.task.uid}`,
          channelId,
          ...(callerId ? { callerId } : {}),
          timeout: input.campaign.dial_timeout_sec,
          variables: {
            ...input.variables,
            KRSK_AC_TASK: String(input.task.uid),
            KRSK_AC_ATTEMPT: String(input.attempt.uid),
            KRSK_AC_CAMPAIGN: String(input.campaign.uid),
          },
        });
        return true;
      } catch (e) {
        lastError = (e as Error).message;
        this.logger.error(
          `Originate failed for task ${input.task.uid} on ${target.trunkId}: ${lastError}`,
        );
        this.attemptByChannel.delete(channelId);
        this.state.dropChannel(channelId);
      }
    }

    await this.attempts.finalize({
      attemptUid: input.attempt.uid,
      disposition: 'failed',
      hangupCause: lastError.slice(0, 64),
    });
    return false;
  }

  // ── ARI events ────────────────────────────────────────────────────

  @OnEvent('ari.ChannelStateChange')
  async onChannelStateChange(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;
    if (event.channel?.state !== 'Up') return;
    await this.handOffAnsweredChannel(channelId);
  }

  @OnEvent('ari.StasisStart')
  async onStasisStart(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;
    const parsed = parseAutodialChannelId(channelId);
    if (!parsed) return;

    if (event.channel?.state === 'Up') {
      await this.handOffAnsweredChannel(channelId, parsed.campaignUid);
    }
  }

  @OnEvent('ari.ChannelDestroyed')
  async onChannelDestroyed(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;

    const live = this.state.getChannel(channelId);
    const persisted = live || this.attemptByChannel.has(channelId)
      ? null
      : await this.attempts.findOpenByChannelId(channelId);
    const attemptUid = this.attemptByChannel.get(channelId)
      ?? live?.attemptUid
      ?? persisted?.uid;
    this.attemptByChannel.delete(channelId);
    this.handedOffChannels.delete(channelId);

    const cause = Number(event.cause ?? 0);
    const answeredAt = live?.answeredAt
      ? new Date(live.answeredAt)
      : persisted?.answered_at ?? null;
    const billsec = answeredAt ? Math.round((Date.now() - answeredAt.getTime()) / 1000) : 0;

    let disposition = dispositionFromHangupCause(cause);
    if (answeredAt) {
      const campaignUid = live?.campaignUid ?? persisted?.campaign_uid;
      const campaign = campaignUid != null
        ? await this.campaignModel.findByPk(campaignUid, { attributes: ['success_min_sec'] })
        : null;
      disposition = dispositionFromAnsweredCall({
        billsec,
        successMinSec: campaign?.success_min_sec ?? 15,
      });
    }

    this.state.removeChannel(channelId, disposition);
    if (attemptUid == null) return;

    await this.attempts.finalize({
      attemptUid,
      disposition,
      hangupCause: event.cause_txt ?? String(cause),
      billsec,
      answeredAt,
    });
  }

  /**
   * Contact fields as inheritable channel variables. `__` prefix so Local and
   * queue-member child channels see the same data the scenario reads.
   */
  private async buildChannelVariables(
    task: AcTask,
    campaign: AcCampaign,
    number: string,
  ): Promise<{
    variables: Record<string, string>;
    contactValues: Record<string, string | number | boolean>;
  }> {
    const vars: Record<string, string> = { KRSK_AC_NUMBER: number };
    const [contact, fields] = await Promise.all([
      this.contactModel.findOne({
        where: { uid: task.contact_uid, base_uid: campaign.base_uid },
      }),
      this.fieldModel.findAll({ where: { base_uid: campaign.base_uid } }),
    ]);
    if (!contact) return { variables: vars, contactValues: {} };

    Object.assign(vars, autodialContactVariables(fields, contact.values ?? {}, number));
    return { variables: vars, contactValues: contact.values ?? {} };
  }

  /**
   * Directory Caller ID is deliberately resolved in the dialer, not in a
   * generated dialplan. The key is an explicit outbound contact field, and a
   * failed lookup falls back to the configured per-trunk/legacy value so a
   * temporary directory issue cannot silently drop a queued call.
   */
  private async resolveCallerId(
    target: AutodialDialTarget,
    campaign: AcCampaign,
    contactValues: Record<string, string | number | boolean>,
  ): Promise<string | null> {
    const source = target.callerIdSource;
    if (source?.mode !== 'directory') return target.callerId;

    const lookupValue = String(contactValues[source.key.field_key] ?? '').trim();
    if (!lookupValue) return target.callerId;

    try {
      const result = await this.directories.lookup({
        directoryUid: source.directory_uid,
        userUid: campaign.user_uid,
        key: lookupValue,
        fieldUids: [source.value_field_uid],
      });
      const resolved = result.status === 'FOUND' ? result.values[0]?.trim() : '';
      return resolved || target.callerId;
    } catch (error) {
      this.logger.warn(
        `Caller ID directory lookup failed for campaign ${campaign.uid}: ${(error as Error).message}`,
      );
      return target.callerId;
    }
  }

  private async failTask(
    task: AcTask,
    disposition: 'invalid_number' | 'failed' | 'dnc',
    reason: string,
  ): Promise<void> {
    this.logger.warn(`Task ${task.uid} not dialable: ${reason}`);
    await task.update({
      status: 'completed',
      last_disposition: disposition,
      last_cause: reason.slice(0, 64),
      leased_by: null,
      leased_at: null,
    });
  }

  /**
   * Subscriber is outside the campaign clock window in their own offset.
   * Release the lease without burning an attempt (B04 / R2c).
   */
  private async deferTask(task: AcTask, reason: string): Promise<void> {
    this.logger.debug(`Task ${task.uid} deferred: ${reason}`);
    await task.update({
      status: 'pending',
      leased_by: null,
      leased_at: null,
      next_attempt_at: new Date(Date.now() + SUBSCRIBER_HOURS_RETRY_MS),
      last_cause: reason.slice(0, 64),
    });
  }

  /**
   * StasisStart at channel creation is not an answer. The scenario only starts
   * after ARI reports `Up`; duplicate Up/Stasis events are collapsed here.
   */
  private async handOffAnsweredChannel(
    channelId: string,
    parsedCampaignUid?: number,
  ): Promise<void> {
    const parsed = parsedCampaignUid == null ? parseAutodialChannelId(channelId) : null;
    const campaignUid = parsedCampaignUid ?? parsed?.campaignUid;
    if (campaignUid == null || this.handedOffChannels.has(channelId)) return;

    this.handedOffChannels.add(channelId);
    this.state.markAnswered(channelId);
    try {
      await this.attempts.markAnswered(channelId, new Date());
      await this.ari.continueInDialplan(
        channelId,
        autodialCampaignContextName(campaignUid),
        's',
        1,
      );
    } catch (e) {
      // A later event may retry the handoff; never mark this call answered a
      // second time because AutodialStateService makes that transition idempotent.
      this.handedOffChannels.delete(channelId);
      this.logger.error(
        `continueInDialplan failed for ${channelId}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Drop in-memory channels whose trunk has been empty on AMI longer than
   * `graceMs`. Lost ARI ChannelDestroyed events otherwise pin trunk capacity.
   */
  async sweepAmiGhosts(
    liveByTrunk: ReadonlyMap<string, number>,
    graceMs = 25_000,
  ): Promise<number> {
    const now = Date.now();
    let swept = 0;
    for (const channel of this.state.listAllChannels()) {
      if (now - channel.startedAt < graceMs) continue;
      if ((liveByTrunk.get(channel.trunkId) ?? 0) > 0) continue;
      this.logger.warn(`Sweeping AMI-empty ghost channel ${channel.channelId}`);
      await this.onChannelDestroyed({
        channel: { id: channel.channelId },
        cause: 0,
        cause_txt: 'ghost_ami_empty',
      });
      swept += 1;
    }
    return swept;
  }

  /** Exposed for the reconciler: forget cached mappings for a closed channel. */
  forgetChannel(channelId: string): void {
    this.attemptByChannel.delete(channelId);
  }

  /** Look up the attempt a channel belongs to (used by the internal endpoint). */
  attemptUidFor(channelId: string): number | undefined {
    return this.attemptByChannel.get(channelId);
  }
}
