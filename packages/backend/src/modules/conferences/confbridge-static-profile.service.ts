import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AmiService } from '../ami/ami.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import {
  CONFBRIDGE_BRIDGE_PROFILE,
  CONFERENCE_PLATFORM_CODECS,
} from './conference-dialplan.util';

/** ConfBridge `type=bridge` rejects unknown keys — `allow` is not a bridge option. */
const BRIDGE_PROFILE_LINES = ['type=bridge', 'video_mode=sfu', 'enable_events=yes'] as const;

@Injectable()
export class ConfbridgeStaticProfileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfbridgeStaticProfileService.name);

  constructor(
    private readonly amiService: AmiService,
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly endpointsService: EndpointsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (CONFERENCE_PLATFORM_CODECS.length === 0) {
      throw new Error(
        'CONFERENCE_PLATFORM_CODECS is empty — refusing to provision krsk_conf_sfu without a video codec',
      );
    }

    try {
      const config = await this.readConfig();
      const loaded = await this.isProfileLoaded();
      const staleAllow = this.configHasInvalidAllow(config, CONFBRIDGE_BRIDGE_PROFILE);
      const missingEvents = loaded && !this.configHasEnableEvents(config, CONFBRIDGE_BRIDGE_PROFILE);

      if (loaded && !staleAllow && !missingEvents) {
        this.logger.log(`Static ConfBridge profile ${CONFBRIDGE_BRIDGE_PROFILE} already present`);
        return;
      }

      try {
        await this.dialplanApplyService.applyCategories(
          'confbridge.conf',
          [
            {
              name: CONFBRIDGE_BRIDGE_PROFILE,
              lines: [...BRIDGE_PROFILE_LINES],
            },
          ],
          { reload: false },
        );
        await this.amiService.command('module reload app_confbridge.so');
        if (!(await this.isProfileLoaded())) {
          this.logger.error(
            `Wrote ${CONFBRIDGE_BRIDGE_PROFILE} but app_confbridge did not load it`,
          );
          return;
        }
        this.logger.log(`Provisioned static ConfBridge profile ${CONFBRIDGE_BRIDGE_PROFILE}`);
      } catch (e: any) {
        this.logger.error(
          `Failed to provision ${CONFBRIDGE_BRIDGE_PROFILE}: ${e?.message || e}`,
        );
      }
    } finally {
      try {
        await this.endpointsService.backfillWebrtcVideo();
      } catch (e: any) {
        this.logger.error(`backfillWebrtcVideo failed: ${e?.message || e}`);
      }
    }
  }

  private async readConfig(): Promise<unknown> {
    try {
      return await this.amiService.action({
        action: 'GetConfig',
        filename: 'confbridge.conf',
      });
    } catch (e: any) {
      this.logger.error(
        `GetConfig confbridge.conf failed — treating as missing profile: ${e?.message || e}`,
      );
      return null;
    }
  }

  private async isProfileLoaded(): Promise<boolean> {
    try {
      const raw = await this.amiService.command(
        `confbridge show profile bridge ${CONFBRIDGE_BRIDGE_PROFILE}`,
      );
      const text = this.commandText(raw);
      if (!text || /no conference bridge profile named/i.test(text)) {
        return false;
      }
      return text.includes(CONFBRIDGE_BRIDGE_PROFILE) || /video_mode/i.test(text);
    } catch {
      return false;
    }
  }

  private commandText(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
      const rec = raw as Record<string, unknown>;
      if (typeof rec.output === 'string') return rec.output;
      if (Array.isArray(rec.output)) return rec.output.map(String).join('\n');
      if (typeof rec.content === 'string') return rec.content;
    }
    try {
      return JSON.stringify(raw ?? '');
    } catch {
      return '';
    }
  }

  private configHasInvalidAllow(response: unknown, category: string): boolean {
    if (!this.hasProfile(response, category)) return false;
    return /allow\s*=/.test(JSON.stringify(response).toLowerCase());
  }

  private configHasEnableEvents(response: unknown, category: string): boolean {
    if (!this.hasProfile(response, category)) return false;
    return /enable_events\s*=\s*yes/.test(JSON.stringify(response).toLowerCase());
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
