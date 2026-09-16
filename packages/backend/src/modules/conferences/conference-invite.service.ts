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
import { conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import type { ConferenceInviteDto } from './dto/conference-invite.dto';

type InviteUser = { sub: number; vpbx_user_uid: number };

@Injectable()
export class ConferenceInviteService {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly amiService: AmiService,
    private readonly loggerService: LoggerService,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
  ) {}

  async invite(roomUid: number, user: InviteUser, dto: ConferenceInviteDto) {
    await this.roomsService.assertLiveRoomAccess(roomUid, user);
    const room = await this.roomsService.findOne(roomUid, user.vpbx_user_uid);

    if (dto.kind === 'internal') {
      return this.inviteInternal(room, user, dto.target);
    }

    throw new BadRequestException('Unsupported invite kind');
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
