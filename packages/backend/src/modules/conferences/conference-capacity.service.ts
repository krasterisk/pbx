import { Injectable } from '@nestjs/common';
import {
  STREAM_KBPS,
  effectiveMax,
  maxParticipantsForBudget,
  streamsForParticipants,
} from './conference-capacity.util';
import { ConferenceStateService } from './conference-state.service';

const DEFAULT_UPLINK_KBPS = 100000;

@Injectable()
export class ConferenceCapacityService {
  constructor(private readonly stateService: ConferenceStateService) {}

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
}
