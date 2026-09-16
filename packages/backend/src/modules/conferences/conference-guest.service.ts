import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { EndpointsService } from '../endpoints/endpoints.service';
import {
  STREAM_KBPS,
  effectiveMax,
  maxParticipantsForBudget,
  streamsForParticipants,
} from './conference-capacity.util';
import { conferenceRoomContextName } from './conference-dialplan.util';
import { conferenceEntryPolicy } from './conference-entry-policy.util';
import type { ConferenceGuestUser } from './conference-guest-token.guard';
import { conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import type { ConferenceGuestJoinDto } from './dto/conference-guest-join.dto';
import { ConferenceGuestToken } from './models/conference-guest-token.model';

@Injectable()
export class ConferenceGuestService {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
    private readonly endpointsService: EndpointsService,
    @InjectModel(ConferenceGuestToken)
    private readonly tokenModel: typeof ConferenceGuestToken,
  ) {}

  async getMeta(user: ConferenceGuestUser) {
    const room = await this.roomsService.findOne(user.roomUid, user.guestVpbxUserUid);
    const policy = conferenceEntryPolicy(room);
    return {
      name: room.name,
      entry_strictness: room.entry_strictness,
      requiresPin: policy.requiresPin,
    };
  }

  async join(user: ConferenceGuestUser, dto: ConferenceGuestJoinDto = {}) {
    const room = await this.roomsService.findOne(user.roomUid, user.guestVpbxUserUid);
    const snapshot = this.stateService.getSnapshot(room.uid);
    const nThis = snapshot.participants.length;
    const used = this.stateService
      .getActiveRoomUids()
      .reduce((sum, uid) => sum + streamsForParticipants(this.stateService.getSnapshot(uid).participants.length), 0);
    const uplinkKbps = Number(process.env.CONFERENCE_UPLINK_KBPS) || 100000;
    const remaining = Math.floor(uplinkKbps / STREAM_KBPS) - used;
    const budgetMax = maxParticipantsForBudget(remaining + streamsForParticipants(nThis));
    const max = effectiveMax(room.tariff_max_participants ?? null, budgetMax);

    if (nThis + 1 > max) {
      throw conferenceRoomHttpError(
        HttpStatus.CONFLICT,
        'CONFERENCE_ROOM_FULL',
        'Conference room is full',
      );
    }

    const token = await this.tokenModel.findByPk(user.guestTokenUid);
    if (!token) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }

    const password = this.endpointsService.generateSipPassword();
    const sipId = `gst${crypto.randomBytes(4).toString('hex')}`;
    if (token.sip_id) {
      await this.endpointsService.destroyEphemeralGuestEndpoint(token.sip_id, user.guestVpbxUserUid);
    }
    await this.endpointsService.createEphemeralGuestEndpoint({
      sipId,
      password,
      context: conferenceRoomContextName(room.uid),
      vpbx: user.guestVpbxUserUid,
      maxVideoStreams: max,
    });

    const displayName = String(dto.displayName ?? '').trim();
    await token.update({
      sip_id: sipId,
      ...(displayName ? { display_name: displayName } : {}),
    });

    return {
      sipId,
      password,
      sipDomain: process.env.SIP_DOMAIN || null,
      roomUid: room.uid,
    };
  }
}
