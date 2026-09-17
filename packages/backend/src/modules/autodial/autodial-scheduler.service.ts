import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { IAutodialSchedule } from '@krasterisk/shared';
import { AcCampaign } from './models/ac-campaign.model';
import { AcSchedule } from './models/ac-schedule.model';
import { AcTask } from './models/ac-task.model';
import { campaignWindowOpen } from './autodial-schedule.util';

/**
 * Moves campaigns in and out of `running` according to their calendar, and
 * marks a campaign `completed` once no dialable task is left.
 *
 * Only campaigns the calendar itself paused are auto-resumed: a manual pause
 * sticks until an operator resumes it.
 */
@Injectable()
export class AutodialSchedulerService {
  private readonly logger = new Logger(AutodialSchedulerService.name);
  private readonly calendarPaused = new Set<number>();

  constructor(
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcSchedule) private readonly scheduleModel: typeof AcSchedule,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    try {
      await this.applyCalendar(new Date());
    } catch (e) {
      this.logger.error(`Autodial scheduler tick failed: ${(e as Error).message}`);
    }
  }

  async applyCalendar(now: Date): Promise<void> {
    const campaigns = await this.campaignModel.findAll({
      where: { status: { [Op.in]: ['running', 'paused', 'scheduled'] } },
    });
    if (!campaigns.length) return;

    const schedules = await this.schedulesByCampaign(campaigns.map((c) => c.uid));

    for (const campaign of campaigns) {
      const rows = schedules.get(campaign.uid) ?? [];
      const open = campaignWindowOpen(rows, now);

      if (campaign.status === 'running' && !open) {
        await campaign.update({ status: 'paused' });
        this.calendarPaused.add(campaign.uid);
        this.logger.log(`Campaign ${campaign.uid} paused — outside its dialing window`);
        continue;
      }

      if (campaign.status !== 'running' && open) {
        const autoResumable =
          campaign.status === 'scheduled' || this.calendarPaused.has(campaign.uid);
        if (autoResumable) {
          await campaign.update({ status: 'running' });
          this.calendarPaused.delete(campaign.uid);
          this.logger.log(`Campaign ${campaign.uid} resumed — inside its dialing window`);
        }
        continue;
      }

      if (campaign.status === 'running') {
        await this.completeIfDrained(campaign);
      }
    }
  }

  /** A running campaign with nothing left to dial becomes `completed`. */
  private async completeIfDrained(campaign: AcCampaign): Promise<void> {
    const remaining = await this.taskModel.count({
      where: {
        campaign_uid: campaign.uid,
        user_uid: campaign.user_uid,
        status: { [Op.in]: ['pending', 'leased', 'dialing'] },
      },
    });
    if (remaining > 0) return;
    const total = await this.taskModel.count({
      where: { campaign_uid: campaign.uid, user_uid: campaign.user_uid },
    });
    if (total === 0) return;
    await campaign.update({ status: 'completed' });
    this.calendarPaused.delete(campaign.uid);
    this.logger.log(`Campaign ${campaign.uid} completed — no tasks left`);
  }

  private async schedulesByCampaign(
    campaignUids: number[],
  ): Promise<Map<number, IAutodialSchedule[]>> {
    const out = new Map<number, IAutodialSchedule[]>();
    const rows = await this.scheduleModel.findAll({
      where: { campaign_uid: { [Op.in]: campaignUids } },
    });
    for (const r of rows) {
      const list = out.get(r.campaign_uid) ?? [];
      list.push({
        uid: r.uid,
        campaign_uid: r.campaign_uid,
        kind: r.kind,
        weekday: r.weekday,
        time_from: r.time_from,
        time_to: r.time_to,
        timezone: r.timezone,
        date_from: r.date_from,
        date_to: r.date_to,
        enabled: r.enabled,
      });
      out.set(r.campaign_uid, list);
    }
    return out;
  }
}
