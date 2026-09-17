import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { AutodialDisposition } from '@krasterisk/shared';
import { Cdr } from '../reports/cdr/cdr.model';
import { AcAttempt } from './models/ac-attempt.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AutodialAttemptService } from './autodial-attempt.service';
import { AutodialStateService } from './autodial-state.service';
import { dispositionFromAnsweredCall } from './autodial-disposition.util';

/**
 * Third and last line of defence for attempt outcomes, after ARI events and the
 * dialplan hangup handler: any attempt still `dialing` well past its dial
 * timeout gets closed from CDR, or marked failed if CDR has nothing either.
 *
 * Without this, a backend restart mid-call leaves the task stuck forever —
 * exactly the bug the existing callback-requests module suffers from.
 */
@Injectable()
export class AutodialReconcilerService {
  private readonly logger = new Logger(AutodialReconcilerService.name);
  /** Generous margin over the longest plausible dial + talk time. */
  private static readonly STALE_AFTER_MS = 6 * 60 * 60 * 1000;

  constructor(
    @InjectModel(AcAttempt) private readonly attemptModel: typeof AcAttempt,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(Cdr) private readonly cdrModel: typeof Cdr,
    private readonly attempts: AutodialAttemptService,
    private readonly state: AutodialStateService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileStale(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - AutodialReconcilerService.STALE_AFTER_MS);
      const stale = await this.attempts.findStaleAttempts(cutoff);
      if (!stale.length) return;

      for (const attempt of stale) {
        // A channel still in live state is a long call, not a lost one.
        if (attempt.channel_id && this.state.getChannel(attempt.channel_id)) continue;
        await this.closeFromCdr(attempt);
      }
      this.logger.log(`Reconciled ${stale.length} stale autodial attempt(s)`);
    } catch (e) {
      this.logger.error(`Autodial reconcile failed: ${(e as Error).message}`);
    }
  }

  private async closeFromCdr(attempt: AcAttempt): Promise<void> {
    const cdr = await this.findCdr(attempt);
    if (!cdr) {
      await this.attempts.finalize({
        attemptUid: attempt.uid,
        disposition: 'failed',
        hangupCause: 'reconciled_no_cdr',
      });
      return;
    }

    const campaign = await this.campaignModel.findByPk(attempt.campaign_uid, {
      attributes: ['success_min_sec'],
    });
    const disposition: AutodialDisposition =
      cdr.billsec > 0
        ? dispositionFromAnsweredCall({
            billsec: cdr.billsec,
            successMinSec: campaign?.success_min_sec ?? 15,
            amdResult: attempt.amd_result,
          })
        : cdrDispositionToAutodial(cdr.disposition);

    await this.attempts.finalize({
      attemptUid: attempt.uid,
      disposition,
      hangupCause: `cdr:${cdr.disposition}`,
      billsec: cdr.billsec,
      duration: cdr.duration,
      talkSec: cdr.billsec,
      uniqueid: cdr.uniqueid,
      linkedid: cdr.linkedid,
      answeredAt: cdr.billsec > 0 ? attempt.started_at : null,
    });
  }

  /**
   * Match on uniqueid/linkedid when the dialplan reported them, otherwise fall
   * back to the channel name Asterisk derives from our ARI channel id.
   */
  private async findCdr(attempt: AcAttempt): Promise<Cdr | null> {
    if (attempt.uniqueid) {
      const byId = await this.cdrModel.findOne({ where: { uniqueid: attempt.uniqueid } });
      if (byId) return byId;
    }
    if (attempt.linkedid) {
      const byLinked = await this.cdrModel.findOne({
        where: { linkedid: attempt.linkedid },
        order: [['calldate', 'ASC']],
      });
      if (byLinked) return byLinked;
    }
    if (!attempt.channel_id) return null;
    return this.cdrModel.findOne({
      where: { channel: { [Op.like]: `%${attempt.channel_id}%` } },
    });
  }
}

function cdrDispositionToAutodial(disposition: string): AutodialDisposition {
  switch (disposition?.toUpperCase()) {
    case 'ANSWERED':
      return 'answered_short';
    case 'BUSY':
      return 'busy';
    case 'NO ANSWER':
    case 'NOANSWER':
      return 'no_answer';
    case 'CONGESTION':
      return 'congestion';
    default:
      return 'failed';
  }
}
