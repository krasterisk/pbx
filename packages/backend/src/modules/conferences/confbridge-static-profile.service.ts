import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AmiService } from '../ami/ami.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import {
  CONFBRIDGE_BRIDGE_PROFILE,
  CONFERENCE_PLATFORM_CODECS,
} from './conference-dialplan.util';

@Injectable()
export class ConfbridgeStaticProfileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfbridgeStaticProfileService.name);

  constructor(
    private readonly amiService: AmiService,
    private readonly dialplanApplyService: DialplanApplyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (CONFERENCE_PLATFORM_CODECS.length === 0) {
      throw new Error(
        'CONFERENCE_PLATFORM_CODECS is empty — refusing to provision krsk_conf_sfu without a video codec',
      );
    }

    let response: unknown;
    try {
      response = await this.amiService.action({
        action: 'GetConfig',
        filename: 'confbridge.conf',
      });
    } catch (e: any) {
      this.logger.error(
        `GetConfig confbridge.conf failed — treating as missing profile: ${e?.message || e}`,
      );
      response = null;
    }

    if (this.hasProfile(response, CONFBRIDGE_BRIDGE_PROFILE)) {
      this.logger.log(`Static ConfBridge profile ${CONFBRIDGE_BRIDGE_PROFILE} already present`);
      return;
    }

    try {
      await this.dialplanApplyService.applyCategories(
        'confbridge.conf',
        [
          {
            name: CONFBRIDGE_BRIDGE_PROFILE,
            lines: [
              'type=bridge',
              'video_mode=sfu',
              `allow=${CONFERENCE_PLATFORM_CODECS.join(',')}`,
            ],
          },
        ],
        { reload: false },
      );
      await this.amiService.command('module reload app_confbridge.so');
      this.logger.log(`Provisioned static ConfBridge profile ${CONFBRIDGE_BRIDGE_PROFILE}`);
    } catch (e: any) {
      this.logger.error(
        `Failed to provision ${CONFBRIDGE_BRIDGE_PROFILE}: ${e?.message || e}`,
      );
    }
  }

  private hasProfile(response: unknown, category: string): boolean {
    if (!response || typeof response !== 'object') return false;
    const record = response as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (/^category-\d+$/i.test(key) && String(value) === category) {
        return true;
      }
      if (typeof value === 'string' && value.includes(`[${category}]`)) {
        return true;
      }
    }
    return JSON.stringify(response).includes(category);
  }
}
