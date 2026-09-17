import { Injectable, Logger } from '@nestjs/common';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { AcCampaign } from './models/ac-campaign.model';
import {
  autodialCampaignContextName,
  autodialConfigFile,
  generateAutodialCampaignDialplan,
  generateAutodialFinalizeContext,
  withMachineTail,
} from './autodial-dialplan.util';

/**
 * Writes campaign contexts into krasterisk/autodial/ac_{vpbx}.conf.
 *
 * Ops prerequisite: AMI CreateConfig cannot create parent directories, so
 * `krasterisk/autodial` must be mkdir'd under AST_CONFIG_DIR once.
 */
@Injectable()
export class AutodialDialplanService {
  private readonly logger = new Logger(AutodialDialplanService.name);

  constructor(private readonly dialplanApply: DialplanApplyService) {}

  /** Regenerate one campaign context plus the shared finalize handler. */
  async applyCampaign(campaign: AcCampaign): Promise<void> {
    const vpbx = campaign.user_uid;
    const category = withMachineTail(
      generateAutodialCampaignDialplan(
        {
          uid: campaign.uid,
          name: campaign.name,
          amd: campaign.amd,
          queue_names: campaign.queue_names ?? [],
          scenario_actions: campaign.scenario_actions ?? [],
        },
        vpbx,
      ),
      campaign.amd,
    );

    try {
      await this.dialplanApply.applyCategories(
        autodialConfigFile(vpbx),
        [category, generateAutodialFinalizeContext(vpbx)],
        { reload: true },
      );
      this.logger.log(`Applied autodial dialplan for campaign ${campaign.uid} (tenant ${vpbx})`);
    } catch (e) {
      // Same contract as routes/conferences: DB is saved, dialplan may lag.
      this.logger.error(
        `Autodial dialplan apply failed for campaign ${campaign.uid}: ${(e as Error).message}. DB saved — re-save to retry.`,
      );
    }
  }

  /** Drop a campaign context when the campaign is deleted. */
  async removeCampaign(campaign: { uid: number; user_uid: number }): Promise<void> {
    try {
      await this.dialplanApply.deleteCategories(
        autodialConfigFile(campaign.user_uid),
        [autodialCampaignContextName(campaign.uid)],
        { reload: true },
      );
    } catch (e) {
      this.logger.error(
        `Autodial dialplan delete failed for campaign ${campaign.uid}: ${(e as Error).message}`,
      );
    }
  }
}
