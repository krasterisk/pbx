import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { AcCampaign } from './models/ac-campaign.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcTask } from './models/ac-task.model';
import { AutodialAttemptService } from './autodial-attempt.service';
import { AutodialStateService } from './autodial-state.service';
import { buildAutodialChannelId, parseAutodialChannelId } from './autodial-phone.util';
import { autodialCampaignContextName } from './autodial-dialplan.util';
import { selectAutodialTrunk } from './autodial-trunk.util';
import {
  dispositionFromAnsweredCall,
  dispositionFromHangupCause,
} from './autodial-disposition.util';

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

  constructor(
    private readonly ari: AriHttpClientService,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcContact) private readonly contactModel: typeof AcContact,
    @InjectModel(AcContactPhone) private readonly phoneModel: typeof AcContactPhone,
    @InjectModel(AcBaseField) private readonly fieldModel: typeof AcBaseField,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    private readonly attempts: AutodialAttemptService,
    private readonly state: AutodialStateService,
  ) {}

  /**
   * Dial one leased task. Returns false when the task could not be dialed at
   * all, so the pacer can release the reservation immediately.
   */
  async originate(task: AcTask, campaign: AcCampaign): Promise<boolean> {
    const phone = await this.phoneModel.findOne({
      where: { uid: task.phone_uid, base_uid: campaign.base_uid },
    });
    if (!phone?.normalized) {
      await this.failTask(task, 'invalid_number', 'no normalized phone');
      return false;
    }

    const target = selectAutodialTrunk(
      campaign.trunk_pool,
      campaign.cid_policy,
      phone.normalized,
      task.uid + task.attempt_count,
    );
    if (!target) {
      await this.failTask(task, 'failed', 'no trunk in pool');
      return false;
    }

    const attemptNo = task.attempt_count + 1;
    const channelId = buildAutodialChannelId(campaign.uid, task.uid, attemptNo);
    const variables = await this.buildChannelVariables(task, campaign, phone.normalized);

    const attempt = await this.attempts.openAttempt({
      userUid: campaign.user_uid,
      taskUid: task.uid,
      campaignUid: campaign.uid,
      attemptNo,
      channelId,
      trunkId: target.trunkId,
      callerId: target.callerId,
    });

    await task.update({
      status: 'dialing',
      attempt_count: attemptNo,
      last_disposition: 'dialing',
    });

    try {
      await this.ari.originateChannel({
        endpoint: target.endpoint,
        app: this.ari.getAppName(),
        appArgs: `autodial,${campaign.uid},${task.uid}`,
        channelId,
        callerId: target.callerId ?? undefined,
        timeout: campaign.dial_timeout_sec,
        variables: {
          ...variables,
          KRSK_AC_TASK: String(task.uid),
          KRSK_AC_ATTEMPT: String(attempt.uid),
          KRSK_AC_CAMPAIGN: String(campaign.uid),
        },
      });

      this.attemptByChannel.set(channelId, attempt.uid);
      this.state.addChannel({
        channelId,
        campaignUid: campaign.uid,
        taskUid: task.uid,
        attemptUid: attempt.uid,
        attemptNo,
        userUid: campaign.user_uid,
        number: phone.normalized,
        trunkId: target.trunkId,
        startedAt: Date.now(),
        answeredAt: null,
      });

      await this.ari.dialChannel(channelId, campaign.dial_timeout_sec);
      return true;
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Originate failed for task ${task.uid}: ${message}`);
      this.attemptByChannel.delete(channelId);
      this.state.removeChannel(channelId, 'failed');
      await this.attempts.finalize({
        attemptUid: attempt.uid,
        disposition: 'failed',
        hangupCause: message.slice(0, 64),
      });
      return false;
    }
  }

  // ── ARI events ────────────────────────────────────────────────────

  @OnEvent('ari.ChannelStateChange')
  async onChannelStateChange(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;
    if (event.channel?.state !== 'Up') return;
    this.state.markAnswered(channelId);
  }

  @OnEvent('ari.StasisStart')
  async onStasisStart(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;
    const parsed = parseAutodialChannelId(channelId);
    if (!parsed) return;

    this.state.markAnswered(channelId);
    // Hand the answered channel to the campaign scenario. Everything after this
    // point is dialplan territory; the finalize handler reports back over HTTP.
    try {
      await this.ari.continueInDialplan(
        channelId,
        autodialCampaignContextName(parsed.campaignUid),
        's',
        1,
      );
    } catch (e) {
      this.logger.error(
        `continueInDialplan failed for ${channelId}: ${(e as Error).message}`,
      );
    }
  }

  @OnEvent('ari.ChannelDestroyed')
  async onChannelDestroyed(event: AriChannelEvent): Promise<void> {
    const channelId = event.channel?.id;
    if (!channelId || !channelId.startsWith('ac-')) return;

    const live = this.state.getChannel(channelId);
    const attemptUid = this.attemptByChannel.get(channelId)
      ?? live?.attemptUid;
    this.attemptByChannel.delete(channelId);

    const cause = Number(event.cause ?? 0);
    const answeredAt = live?.answeredAt ? new Date(live.answeredAt) : null;
    const billsec = answeredAt ? Math.round((Date.now() - answeredAt.getTime()) / 1000) : 0;

    let disposition = dispositionFromHangupCause(cause);
    if (answeredAt) {
      const campaign = live
        ? await this.campaignModel.findByPk(live.campaignUid, { attributes: ['success_min_sec'] })
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
  ): Promise<Record<string, string>> {
    const vars: Record<string, string> = { KRSK_AC_NUMBER: number };
    const [contact, fields] = await Promise.all([
      this.contactModel.findOne({
        where: { uid: task.contact_uid, base_uid: campaign.base_uid },
      }),
      this.fieldModel.findAll({ where: { base_uid: campaign.base_uid } }),
    ]);
    if (!contact) return vars;

    for (const field of fields) {
      const raw = (contact.values ?? {})[String(field.uid)];
      if (raw == null) continue;
      // Newlines and commas would break the dialplan line the value lands in.
      vars[`__${field.var_name}`] = String(raw).replace(/[\r\n,]/g, ' ').slice(0, 255);
    }
    return vars;
  }

  private async failTask(
    task: AcTask,
    disposition: 'invalid_number' | 'failed',
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

  /** Exposed for the reconciler: forget cached mappings for a closed channel. */
  forgetChannel(channelId: string): void {
    this.attemptByChannel.delete(channelId);
  }

  /** Look up the attempt a channel belongs to (used by the internal endpoint). */
  attemptUidFor(channelId: string): number | undefined {
    return this.attemptByChannel.get(channelId);
  }
}
