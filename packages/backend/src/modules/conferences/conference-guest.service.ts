import { HttpException, HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
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
import type { CreateConferenceGuestTokenDto } from './dto/conference-guest-token.dto';
import { ConferenceGuestToken } from './models/conference-guest-token.model';

@Injectable()
export class ConferenceGuestService {
  constructor(
    @Inject(forwardRef(() => ConferenceRoomsService))
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
    private readonly endpointsService: EndpointsService,
    @InjectModel(ConferenceGuestToken)
    private readonly tokenModel: typeof ConferenceGuestToken,
  ) {}

  async createToken(roomUid: number, vpbx: number, dto: CreateConferenceGuestTokenDto) {
    await this.roomsService.findOne(roomUid, vpbx);
    if (dto.kind === 'named_invite' && !String(dto.inviteName ?? '').trim()) {
      throw new HttpException({ message: 'Invite name is required' }, HttpStatus.BAD_REQUEST);
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at =
      dto.ttlSec != null ? new Date(Date.now() + dto.ttlSec * 1000) : null;
    return this.tokenModel.create({
      room_uid: roomUid,
      token,
      kind: dto.kind,
      invite_name: dto.kind === 'named_invite' ? String(dto.inviteName).trim() : null,
      expires_at,
    });
  }

  async listTokens(roomUid: number, vpbx: number) {
    await this.roomsService.findOne(roomUid, vpbx);
    return this.tokenModel.findAll({
      where: { room_uid: roomUid },
      order: [
        ['created_at', 'ASC'],
        ['uid', 'ASC'],
      ],
    });
  }

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
