import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { buildSipId, buildWebrtcSipId } from '../endpoints/endpoint-ids.util';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { LoggerService } from '../logger/logger.service';
import { conferenceRoomContextName } from './conference-dialplan.util';
import { resolveRoleForCaller } from './conference-roles.util';
import { conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import type { ConferenceInviteDto } from './dto/conference-invite.dto';
import type { ConferenceInviteScope } from './models/conference-room.model';

type InviteUser = { sub: number; vpbx_user_uid: number };

type InviteRoom = {
  uid: number;
  name: string;
  number: string;
  user_uid: number;
  invite_external_scope: ConferenceInviteScope;
};

@Injectable()
export class ConferenceInviteService {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly amiService: AmiService,
    private readonly loggerService: LoggerService,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    private readonly stateService: ConferenceStateService,
  ) {}

  async invite(roomUid: number, user: InviteUser, dto: ConferenceInviteDto) {
    await this.roomsService.assertLiveRoomAccess(roomUid, user);
    const room = (await this.roomsService.findOne(roomUid, user.vpbx_user_uid)) as InviteRoom;

    if (dto.kind === 'internal') {
      return this.inviteInternal(room, user, dto.target);
    }

    return this.inviteExternal(room, user, dto.target);
  }

  private async inviteInternal(
    room: { uid: number; name: string; number: string; user_uid: number },
    user: InviteUser,
    target: string,
  ) {
    const raw = String(target ?? '');
    if (/gst/i.test(raw)) {
      throw new BadRequestException('Guest endpoints cannot be invited');
    }
    const exten = raw.trim();
    if (!/^\d+$/.test(exten)) {
      throw new BadRequestException('Internal invite target must be an extension');
    }

    const vpbx = user.vpbx_user_uid;
    const primaryId = buildSipId(vpbx, exten);
    const companionId = buildWebrtcSipId(vpbx, exten);
    const primary = await this.endpointModel.findOne({ where: { id: primaryId } });
    const sipId = primary
      ? primaryId
      : (await this.endpointModel.findOne({ where: { id: companionId } }))
        ? companionId
        : null;

    if (!sipId) {
      throw new NotFoundException(`Endpoint ${exten} not found`);
    }
    if (sipId.startsWith('gst')) {
      throw new BadRequestException('Guest endpoints cannot be invited');
    }

    const channel = `PJSIP/${sipId}`;
    await this.originateIntoRoom(room, channel);
    await this.loggerService.logAction(
      user.sub,
      'conference.invite.internal',
      'conference_room',
      room.uid,
      vpbx,
      target,
    );
    return { accepted: true };
  }

  private async inviteExternal(room: InviteRoom, user: InviteUser, target: string) {
    await this.assertCanInviteExternal(room, user);
    const digits = (target || '').replace(/[^\d+*#]/g, '');
    if (!digits) {
      throw new BadRequestException('Target is required');
    }

    const vpbx = user.vpbx_user_uid;
    const channel = `Local/${digits}@from-internal${vpbx}`;
    await this.originateIntoRoom(room, channel);
    await this.loggerService.logAction(
      user.sub,
      'conference.invite.external',
      'conference_room',
      room.uid,
      vpbx,
      target,
    );
    return { accepted: true };
  }

  private async assertCanInviteExternal(room: InviteRoom, user: InviteUser): Promise<void> {
    if (room.invite_external_scope === 'anyone') {
      return;
    }
    const callerRef = await this.roomsService.resolveCallerRef(user);
    if (!callerRef) {
      throw conferenceRoomHttpError(
        HttpStatus.FORBIDDEN,
        'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN',
        'External invite is not allowed for this role',
      );
    }
    const rows = await this.roomsService.getRoomModerators(room.uid, user.vpbx_user_uid);
    const ownerRef = rows.find((row) => row.role === 'owner')?.endpointRef ?? null;
    const moderatorRefs = rows
      .filter((row) => row.role === 'moderator')
      .map((row) => row.endpointRef);
    const role = resolveRoleForCaller(callerRef, {
      ownerRef,
      moderatorRefs,
      liveGrants: this.stateService.getLiveGrants(room.uid),
    });
    if (room.invite_external_scope === 'owner' && role !== 'owner') {
      throw conferenceRoomHttpError(
        HttpStatus.FORBIDDEN,
        'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN',
        'External invite is not allowed for this role',
      );
    }
    if (
      room.invite_external_scope === 'moderator' &&
      role !== 'owner' &&
      role !== 'moderator'
    ) {
      throw conferenceRoomHttpError(
        HttpStatus.FORBIDDEN,
        'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN',
        'External invite is not allowed for this role',
      );
    }
  }

  private async originateIntoRoom(
    room: { uid: number; name: string; number: string },
    channel: string,
  ) {
    try {
      await this.amiService.originate(
        channel,
        `"${room.name}" <${room.number}>`,
        conferenceRoomContextName(room.uid),
        's',
        '1',
      );
    } catch {
      throw conferenceRoomHttpError(
        HttpStatus.BAD_GATEWAY,
        'CONFERENCE_INVITE_FAILED',
        'Failed to originate invite',
      );
    }
  }
}
