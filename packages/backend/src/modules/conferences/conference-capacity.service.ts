import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  STREAM_KBPS,
  effectiveMax,
  maxParticipantsForBudget,
  streamsForParticipants,
} from './conference-capacity.util';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';

const DEFAULT_UPLINK_KBPS = 100000;

@Injectable()
export class ConferenceCapacityService {
  private readonly logger = new Logger(ConferenceCapacityService.name);
  private running = false;
  private readonly lastApplied = new Map<number, number>();

  constructor(
    private readonly stateService: ConferenceStateService,
    @Optional()
    @Inject(forwardRef(() => ConferenceRoomsService))
    private readonly roomsService?: ConferenceRoomsService,
  ) {}

  uplinkKbps(): number {
    const raw = Number(process.env.CONFERENCE_UPLINK_KBPS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return DEFAULT_UPLINK_KBPS;
  }

  capacityForRoom(room: { uid: number; tariff_max_participants?: number | null }): number {
    const used = this.stateService
      .getActiveRoomUids()
      .reduce(
        (sum, uid) =>
          sum + streamsForParticipants(this.stateService.getSnapshot(uid).participants.length),
        0,
      );
    const remaining = Math.floor(this.uplinkKbps() / STREAM_KBPS) - used;
    const nThis = this.stateService.getSnapshot(room.uid).participants.length;
    const serverMax = maxParticipantsForBudget(remaining + streamsForParticipants(nThis));
    return effectiveMax(room.tariff_max_participants, serverMax);
  }

  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err: any) {
      this.logger.warn(`conference capacity tick failed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }

  private async runOnce(): Promise<void> {
    if (!this.roomsService) return;
    const roomUids = this.stateService.getActiveRoomUids();
    for (const roomUid of roomUids) {
      const identity = this.stateService.getRoomIdentity(roomUid);
      if (!identity) continue;
      try {
        const room = await this.roomsService.findOne(roomUid, identity.vpbx);
        const n = this.capacityForRoom(room);
        if (this.lastApplied.get(roomUid) === n) continue;
        await this.roomsService.reapplyDialplan(room, n);
        this.lastApplied.set(roomUid, n);
      } catch (err: any) {
        this.logger.error(`capacity reapply failed room=${roomUid}: ${err?.message || err}`);
      }
    }
  }
}
