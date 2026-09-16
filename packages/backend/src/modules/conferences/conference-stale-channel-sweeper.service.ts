import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AmiService } from '../ami/ami.service';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { ConferenceStateService } from './conference-state.service';

export const STALE_CHANNEL_THRESHOLD_MS = 120_000;

@Injectable()
export class ConferenceStaleChannelSweeperService {
  private readonly logger = new Logger(ConferenceStaleChannelSweeperService.name);
  private running = false;

  constructor(
    private readonly stateService: ConferenceStateService,
    private readonly amiService: AmiService,
  ) {}

  @Cron('*/1 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err: any) {
      this.logger.warn(`stale channel sweeper failed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }

  private async runOnce(): Promise<void> {
    const roomUids = this.stateService.getActiveRoomUids();
    if (roomUids.length === 0) return;
    if (!this.amiService.isConnected()) return;

    for (const roomUid of roomUids) {
      const identity = this.stateService.getRoomIdentity(roomUid);
      if (!identity) continue;
      const conference = normalizeTarget(
        'conference',
        { source: 'fixed', value: identity.number },
        identity.vpbx,
      );
      const channels = this.stateService.getLiveChannelPairs(roomUid);
      for (const item of channels) {
        if (!this.stateService.isStale(item.channel, STALE_CHANNEL_THRESHOLD_MS)) {
          continue;
        }
        try {
          await this.amiService.action({
            action: 'ConfbridgeKick',
            conference,
            channel: item.channel,
          });
        } catch (err: any) {
          this.logger.warn(
            `stale kick failed room=${roomUid} channel=${item.channel}: ${err?.message || err}`,
          );
        }
      }
    }
  }
}
