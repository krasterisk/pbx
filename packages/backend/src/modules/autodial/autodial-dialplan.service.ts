import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { AmiService } from '../ami/ami.service';
import { PromptsService } from '../prompts/prompts.service';
import { AcCampaign } from './models/ac-campaign.model';
import {
  autodialCampaignContextName,
  autodialConfigFile,
  AUTODIAL_FINALIZE_CONTEXT,
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

  constructor(
    private readonly dialplanApply: DialplanApplyService,
    private readonly ami: AmiService,
    private readonly prompts: PromptsService,
  ) {}

  /** Check PBX capability and voicemail media before a campaign can start using AMD. */
  async assertAmdReady(campaign: AcCampaign): Promise<void> {
    if (!campaign.amd?.enabled) return;
    if (campaign.amd.on_machine === 'voicemail') {
      const filename = String(campaign.amd.message_prompt ?? '').trim();
      if (!filename) {
        throw new BadRequestException({
          code: 'AC_AMD_MESSAGE_NOT_CONFIGURED',
          message: 'Choose a prompt recording before using leave-a-message AMD mode.',
        });
      }
      const resolved = await this.prompts.resolvePromptAudioFile(
        campaign.user_uid,
        filename,
      );
      if (!resolved) {
        throw new BadRequestException({
          code: 'AC_AMD_MESSAGE_NOT_CONFIGURED',
          message: 'The selected AMD message prompt file was not found for this tenant.',
        });
      }
    }
    let response: unknown;
    try {
      response = await this.ami.command('module show like app_amd');
    } catch {
      throw new ServiceUnavailableException({ code: 'AC_AMD_UNAVAILABLE', message: 'AMD capability could not be verified.' });
    }
    const value = response as { output?: string | string[]; content?: string } | null;
    const output = Array.isArray(value?.output)
      ? value.output.join('\n')
      : String(value?.output ?? value?.content ?? (typeof response === 'string' ? response : ''));
    if (!/^app_amd\.so\s+.*\bRunning\b/im.test(output)) {
      throw new ServiceUnavailableException({ code: 'AC_AMD_UNAVAILABLE', message: 'Asterisk AMD application is not loaded.' });
    }
  }

  /** Regenerate one campaign context plus the shared finalize handler. */
  async applyCampaign(campaign: AcCampaign): Promise<boolean> {
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
      vpbx,
    );

    try {
      const filename = autodialConfigFile(vpbx);
      await this.dialplanApply.applyCategories(
        filename,
        [category, generateAutodialFinalizeContext(vpbx)],
        { reload: false },
      );
      // Drop the legacy shared [krsk-ac-finalize] copied into this tenant file.
      await this.dialplanApply.deleteCategories(filename, [AUTODIAL_FINALIZE_CONTEXT], { reload: true });
      this.logger.log(`Applied autodial dialplan for campaign ${campaign.uid} (tenant ${vpbx})`);
      return true;
    } catch (e) {
      // Same contract as routes/conferences: DB is saved, dialplan may lag.
      this.logger.error(
        `Autodial dialplan apply failed for campaign ${campaign.uid}: ${(e as Error).message}. DB saved — re-save to retry.`,
      );
      return false;
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
