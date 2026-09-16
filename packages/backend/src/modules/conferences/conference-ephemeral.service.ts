import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { conferenceRoomContextName } from './conference-dialplan.util';
import { ConferenceRoomsService, conferenceRoomHttpError } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceRoom } from './models/conference-room.model';

export interface EphemeralRoomHandle {
  roomUid: number;
  contextName: string;
  asteriskName: string;
}

@Injectable()
export class ConferenceEphemeralService {
  constructor(
    private readonly roomsService: ConferenceRoomsService,
    @InjectModel(ConferenceRoom) private readonly roomModel: typeof ConferenceRoom,
    private readonly stateService: ConferenceStateService,
  ) {}

  async ensureRoomForCall(
    uniqueid: string,
    vpbx: number,
    createdBy: number | null = null,
  ): Promise<EphemeralRoomHandle> {
    const number = String(uniqueid ?? '')
      .replace(/\D/g, '')
      .slice(0, 32);
    if (!number) {
      throw conferenceRoomHttpError(
        HttpStatus.BAD_REQUEST,
        'CONFERENCE_NUMBER_INVALID',
        'Conference uniqueid must contain at least one digit',
        { uniqueid: String(uniqueid ?? '') },
      );
    }

    const existing = await this.roomModel.findOne({
      where: { user_uid: vpbx, number },
    });
    if (existing) return this.toHandle(existing, vpbx);

    try {
      const room = await this.roomsService.create(
        {
          number,
          name: number,
          kind: 'ephemeral',
          entry_strictness: 'token_name',
        },
        vpbx,
        createdBy,
      );
      return this.toHandle(room, vpbx);
    } catch (e) {
      if (this.isNumberTaken(e)) {
        const raced = await this.roomModel.findOne({
          where: { user_uid: vpbx, number },
        });
        if (raced) return this.toHandle(raced, vpbx);
      }
      throw e;
    }
  }

  async collectIfEmpty(roomUid: number): Promise<void> {
    const room = await this.roomModel.findOne({ where: { uid: roomUid } });
    if (!room || room.kind !== 'ephemeral') return;
    if (this.stateService.getSnapshot(roomUid).participants.length > 0) return;
    await this.roomsService.remove(roomUid, room.user_uid);
  }

  private toHandle(
    room: { uid: number; number: string },
    vpbx: number,
  ): EphemeralRoomHandle {
    return {
      roomUid: room.uid,
      contextName: conferenceRoomContextName(room.uid),
      asteriskName: normalizeTarget('conference', { source: 'fixed', value: room.number }, vpbx),
    };
  }

  private isNumberTaken(e: unknown): boolean {
    if (e instanceof UniqueConstraintError) return true;
    if ((e as { name?: string })?.name === 'SequelizeUniqueConstraintError') return true;
    if (e instanceof HttpException) {
      const body = e.getResponse();
      return typeof body === 'object' && body !== null && (body as { code?: string }).code === 'CONFERENCE_NUMBER_TAKEN';
    }
    return false;
  }
}
