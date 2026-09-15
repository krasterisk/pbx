import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { generateConferenceDialplan } from './conference-dialplan.util';
import { ConferenceStateService } from './conference-state.service';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';
import { ConferenceRoom } from './models/conference-room.model';

export type ConferenceRoomErrorCode =
  | 'CONFERENCE_ROOM_NOT_FOUND'
  | 'CONFERENCE_NUMBER_TAKEN'
  | 'CONFERENCE_NUMBER_INVALID';

export function conferenceRoomHttpError(
  status: HttpStatus,
  code: ConferenceRoomErrorCode,
  message: string,
  params: Record<string, string | number> = {},
): HttpException {
  const body = { code, message, params };
  if (status === HttpStatus.CONFLICT) return new ConflictException(body);
  if (status === HttpStatus.BAD_REQUEST) return new HttpException(body, status);
  if (status === HttpStatus.NOT_FOUND) return new NotFoundException(body);
  return new HttpException(body, status);
}

@Injectable()
export class ConferenceRoomsService {
  private readonly logger = new Logger(ConferenceRoomsService.name);

  constructor(
    @InjectModel(ConferenceRoom) private readonly roomModel: typeof ConferenceRoom,
    private readonly sequelize: Sequelize,
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly stateService: ConferenceStateService,
  ) {}

  private roomFile(vpbx: number): string {
    return `krasterisk/conferences/conf_${vpbx}.conf`;
  }

  async findAll(vpbx: number) {
    const rooms = await this.roomModel.findAll({
      where: { user_uid: vpbx },
      order: [['uid', 'DESC']],
    });
    for (const room of rooms) {
      this.stateService.registerRoom(room);
    }
    return rooms.map((room) => room.toJSON());
  }

  async findOne(uid: number, vpbx: number) {
    const room = await this.roomModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!room) {
      throw conferenceRoomHttpError(
        HttpStatus.NOT_FOUND,
        'CONFERENCE_ROOM_NOT_FOUND',
        `Conference room ${uid} not found`,
        { uid },
      );
    }
    this.stateService.registerRoom(room);
    return room.toJSON();
  }

  async create(
    dto: CreateConferenceRoomDto,
    vpbx: number,
    createdBy: number | null = null,
  ) {
    const data = { ...dto } as CreateConferenceRoomDto & {
      user_uid?: number;
      created_by?: number | null;
    };
    delete data.user_uid;
    delete data.created_by;

    const transaction = await this.sequelize.transaction();
    let committed = false;
    let room: ConferenceRoom;
    try {
      room = await this.roomModel.create(
        {
          ...data,
          user_uid: vpbx,
          created_by: createdBy,
        } as Parameters<typeof this.roomModel.create>[0],
        { transaction },
      );
      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      if (
        e instanceof UniqueConstraintError ||
        (e as { name?: string })?.name === 'SequelizeUniqueConstraintError'
      ) {
        throw conferenceRoomHttpError(
          HttpStatus.CONFLICT,
          'CONFERENCE_NUMBER_TAKEN',
          `Conference number "${dto.number}" is already used in this tenant`,
          { number: dto.number },
        );
      }
      throw e;
    }

    this.stateService.registerRoom(room);

    try {
      await this.applyRoom(room, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan apply failed for conference room ${room.uid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }

    return room.toJSON ? room.toJSON() : room;
  }

  private async applyRoom(room: ConferenceRoom, vpbx: number): Promise<void> {
    const category = generateConferenceDialplan(room, vpbx);
    await this.dialplanApplyService.applyCategories(
      this.roomFile(vpbx),
      [category],
      { reload: true },
    );
  }
}
