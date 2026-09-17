import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AmiService } from '../ami/ami.service';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { ConferenceStateService } from './conference-state.service';

/** Kept for callers/tests; sweeper no longer kicks solely on silence (CR-02). */
export const STALE_CHANNEL_THRESHOLD_MS = 120_000;

function channelFromListEvent(evt: Record<string, unknown>): string {
  const raw = evt.channel ?? evt.Channel;
  return typeof raw === 'string' ? raw.trim() : '';
}

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
      if (channels.length === 0) continue;

      let live: Set<string>;
      try {
        const listed = await this.amiService.confbridgeList(conference);
        live = new Set(
          (listed.events ?? [])
            .map((evt) => channelFromListEvent(evt as Record<string, unknown>))
            .filter(Boolean),
        );
      } catch (err: any) {
        this.logger.warn(
          `ConfbridgeList failed room=${roomUid} conference=${conference}: ${err?.message || err}`,
        );
        continue;
      }

      for (const item of channels) {
        if (live.has(item.channel)) {
          this.stateService.refreshSignal(item.channel);
          continue;
        }
        try {
          await this.stateService.handleLeave({
            Conference: conference,
            Channel: item.channel,
          });
        } catch (err: any) {
          this.logger.warn(
            `reconcile leave failed room=${roomUid} channel=${item.channel}: ${err?.message || err}`,
          );
        }
      }
    }
  }
}
