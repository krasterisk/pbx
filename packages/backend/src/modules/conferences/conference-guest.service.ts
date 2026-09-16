import { HttpException, HttpStatus, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { AmiService } from '../ami/ami.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { ConferenceCapacityService } from './conference-capacity.service';
import { conferenceRoomContextName } from './conference-dialplan.util';
import { conferenceEntryPolicy } from './conference-entry-policy.util';
import type { ConferenceGuestUser } from './conference-guest-token.guard';
import { conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import type { ConferenceDisplayNameDto } from './dto/conference-display-name.dto';
import type { ConferenceGuestJoinDto } from './dto/conference-guest-join.dto';
import type { CreateConferenceGuestTokenDto } from './dto/conference-guest-token.dto';
import { truncateDisplayName } from './dto/conference-participant.dto';
import { ConferenceGuestToken } from './models/conference-guest-token.model';

@Injectable()
export class ConferenceGuestService {
  private readonly logger = new Logger(ConferenceGuestService.name);

  constructor(
    @Inject(forwardRef(() => ConferenceRoomsService))
    private readonly roomsService: ConferenceRoomsService,
    private readonly stateService: ConferenceStateService,
    private readonly endpointsService: EndpointsService,
    @InjectModel(ConferenceGuestToken)
    private readonly tokenModel: typeof ConferenceGuestToken,
    private readonly capacityService: ConferenceCapacityService,
    private readonly amiService?: AmiService,
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

  async join(
    user: ConferenceGuestUser & { role?: 'owner' | 'moderator' | 'participant' },
    dto: ConferenceGuestJoinDto = {},
  ) {
    const room = await this.roomsService.findOne(user.roomUid, user.guestVpbxUserUid);
    const policy = conferenceEntryPolicy(room);
    if (policy.requiresPin) {
      const pin = String(dto.pin ?? '').trim();
      if (!pin) {
        throw conferenceRoomHttpError(
          HttpStatus.BAD_REQUEST,
          'CONFERENCE_PIN_REQUIRED',
          'Conference PIN is required',
        );
      }
      if (pin !== policy.pin) {
        throw conferenceRoomHttpError(
          HttpStatus.BAD_REQUEST,
          'CONFERENCE_PIN_WRONG',
          'Conference PIN is wrong',
        );
      }
    }
    const nThis = this.stateService.getSnapshot(room.uid).participants.length;
    const max = this.capacityService.capacityForRoom(room);
    const adminBypass = user.role === 'owner' || user.role === 'moderator';
    if (!adminBypass && nThis + 1 > max) {
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

    const requested = String(dto.displayName ?? '').trim();
    const saved = String(token.display_name ?? '').trim();
    if (!requested && !saved) {
      throw conferenceRoomHttpError(
        HttpStatus.BAD_REQUEST,
        'CONFERENCE_DISPLAY_NAME_REQUIRED',
        'Display name is required',
      );
    }
    const displayName = truncateDisplayName(requested || saved);

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

    await token.update({
      sip_id: sipId,
      display_name: displayName,
    });
    this.stateService.rememberDisplayName(room.uid, sipId, displayName);

    return {
      sipId,
      password,
      sipDomain: process.env.SIP_DOMAIN || null,
      roomUid: room.uid,
    };
  }

  async revoke(roomUid: number, tokenUid: number, vpbx: number) {
    const room = await this.roomsService.findOne(roomUid, vpbx);
    const token = await this.tokenModel.findOne({
      where: { uid: tokenUid, room_uid: roomUid },
    });
    if (!token) {
      throw conferenceRoomHttpError(
        HttpStatus.NOT_FOUND,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token not found',
        { tokenUid },
      );
    }
    await token.update({ revoked_at: new Date() });
    const sipId = token.sip_id;
    if (!sipId) return;

    const conference = normalizeTarget(
      'conference',
      { source: 'fixed', value: String(room.number) },
      vpbx,
    );
    const channel = this.stateService.findLiveParticipant(roomUid, sipId)?.channel;
    if (channel && this.amiService) {
      try {
        await this.amiService.action({
          action: 'ConfbridgeKick',
          conference,
          channel,
        });
      } catch (err: any) {
        this.logger.warn(`ConfbridgeKick failed during revoke: ${err?.message || err}`);
      }
    }
    try {
      await this.endpointsService.destroyEphemeralGuestEndpoint(sipId, vpbx);
    } catch (err: any) {
      this.logger.warn(
        `destroyEphemeralGuestEndpoint failed during revoke: ${err?.message || err}`,
      );
    }
    await token.update({ sip_id: null });
  }

  async leave(user: ConferenceGuestUser) {
    const token = await this.tokenModel.findByPk(user.guestTokenUid);
    if (!token) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }
    const sipId = token.sip_id;
    if (!sipId) return;
    try {
      await this.endpointsService.destroyEphemeralGuestEndpoint(sipId, user.guestVpbxUserUid);
    } catch (err: any) {
      this.logger.warn(
        `destroyEphemeralGuestEndpoint failed during leave: ${err?.message || err}`,
      );
    }
    await token.update({ sip_id: null });
  }

  async setDisplayName(user: ConferenceGuestUser, dto: ConferenceDisplayNameDto) {
    const token = await this.tokenModel.findByPk(user.guestTokenUid);
    if (!token) {
      throw conferenceRoomHttpError(
        HttpStatus.UNAUTHORIZED,
        'CONFERENCE_GUEST_TOKEN_INVALID',
        'Guest token invalid',
      );
    }
    const displayName = truncateDisplayName(String(dto.displayName ?? '').trim());
    if (!displayName) {
      throw conferenceRoomHttpError(
        HttpStatus.BAD_REQUEST,
        'CONFERENCE_DISPLAY_NAME_REQUIRED',
        'Display name is required',
      );
    }
    await token.update({ display_name: displayName });
    if (token.sip_id) {
      this.stateService.rememberDisplayName(user.roomUid, token.sip_id, displayName);
      this.stateService.setDisplayName(user.roomUid, token.sip_id, displayName);
    }
  }
}
