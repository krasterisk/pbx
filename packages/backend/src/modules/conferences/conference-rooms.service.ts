import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { normalizeAccessToken } from '../callcenter/callcenter-access-list.util';
import { LoggerService } from '../logger/logger.service';
import { User } from '../users/user.model';
import {
  conferenceRoomContextName,
  generateConferenceDialplan,
  generateConferenceMaskIndex,
} from './conference-dialplan.util';
import { ConferenceStateService } from './conference-state.service';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';
import type { CreateConferenceGuestTokenDto } from './dto/conference-guest-token.dto';
import { UpdateConferenceRoomDto } from './dto/update-conference-room.dto';
import { ConferenceGuestService } from './conference-guest.service';
import {
  ConferenceModeratorDto,
  SetConferenceModeratorsDto,
} from './dto/conference-moderator.dto';
import { ConferenceRoom } from './models/conference-room.model';
import { ConferenceRoomModerator } from './models/conference-room-moderator.model';
import type { ConferencePermanentRight } from './conference-dialplan.util';
import {
  conferenceEntryPolicy,
  type ConferenceEntryPolicyRoom,
} from './conference-entry-policy.util';

export type ConferenceRoomErrorCode =
  | 'CONFERENCE_ROOM_NOT_FOUND'
  | 'CONFERENCE_NUMBER_TAKEN'
  | 'CONFERENCE_NUMBER_INVALID'
  | 'CONFERENCE_OWNER_DUPLICATE'
  | 'CONFERENCE_MODERATOR_DUPLICATE'
  | 'CONFERENCE_PIN_REQUIRED'
  | 'CONFERENCE_ROOM_FULL'
  | 'CONFERENCE_GUEST_TOKEN_REVOKED'
  | 'CONFERENCE_GUEST_TOKEN_EXPIRED'
  | 'CONFERENCE_GUEST_TOKEN_INVALID'
  | 'CONFERENCE_PIN_WRONG'
  | 'CONFERENCE_DISPLAY_NAME_REQUIRED'
  | 'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN'
  | 'CONFERENCE_INVITE_FAILED';

export function conferenceRoomHttpError(
  status: HttpStatus,
  code: ConferenceRoomErrorCode,
  message: string,
  params: Record<string, string | number> = {},
): HttpException {
  const body = { code, message, params };
  if (status === HttpStatus.CONFLICT) return new ConflictException(body);
  if (status === HttpStatus.UNAUTHORIZED) return new UnauthorizedException(body);
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
    private readonly loggerService: LoggerService,
    @InjectModel(ConferenceRoomModerator)
    private readonly moderatorModel?: typeof ConferenceRoomModerator,
    @InjectModel(User)
    private readonly userModel?: typeof User,
    @Optional()
    @Inject(forwardRef(() => ConferenceGuestService))
    private readonly guestService?: ConferenceGuestService,
  ) {}

  createGuestToken(roomUid: number, dto: CreateConferenceGuestTokenDto, vpbx: number) {
    return this.guestService!.createToken(roomUid, vpbx, dto);
  }

  listGuestTokens(roomUid: number, vpbx: number) {
    return this.guestService!.listTokens(roomUid, vpbx);
  }

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
    this.assertEntryPolicyConsistent({
      entry_strictness: dto.entry_strictness,
      pin: dto.pin,
      wait_marked: dto.wait_marked,
      end_marked: dto.end_marked,
    });

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

  async update(uid: number, dto: UpdateConferenceRoomDto, vpbx: number) {
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

    const data = { ...dto } as UpdateConferenceRoomDto & {
      user_uid?: number;
      vpbx_user_uid?: number;
    };
    delete data.user_uid;
    delete data.vpbx_user_uid;
    this.assertEntryPolicyConsistent({
      entry_strictness: dto.entry_strictness ?? room.entry_strictness,
      pin: dto.pin !== undefined ? dto.pin : room.pin,
      wait_marked: dto.wait_marked ?? room.wait_marked,
      end_marked: dto.end_marked ?? room.end_marked,
    });
    const updateData: Record<string, unknown> = { ...data };
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });

    const transaction = await this.sequelize.transaction();
    let committed = false;
    try {
      if (Object.keys(updateData).length) {
        await room.update(updateData, { transaction });
      }
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
          { number: dto.number ?? '' },
        );
      }
      throw e;
    }

    this.stateService.registerRoom(room);

    try {
      await this.applyRoom(room, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan apply failed for conference room ${uid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }

    return room.toJSON ? room.toJSON() : room;
  }

  async remove(uid: number, vpbx: number) {
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

    const roomUid = room.uid;
    const transaction = await this.sequelize.transaction();
    let committed = false;
    try {
      await room.destroy({ transaction });
      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      throw e;
    }

    try {
      await this.dialplanApplyService.deleteCategories(
        this.roomFile(vpbx),
        [conferenceRoomContextName(roomUid)],
        { reload: true },
      );
    } catch (e: any) {
      this.logger.error(
        `Dialplan remove failed for conference room ${uid} (${this.roomFile(vpbx)}); DB deleted — dialplan may need cleanup: ${e?.message || e}`,
      );
    }

    try {
      await this.dialplanApplyService.applyCategories(
        this.roomFile(vpbx),
        [await this.buildMaskIndex(vpbx)],
        { reload: true },
      );
    } catch (e: any) {
      this.logger.error(
        `Mask-index apply failed after removing conference room ${uid} (${this.roomFile(vpbx)}); DB deleted — retry/re-save may be needed: ${e?.message || e}`,
      );
    }

    return { success: true };
  }

  async assertLiveRoomAccess(
    roomUid: number,
    user: { sub: number; vpbx_user_uid: number },
  ) {
    const room = await this.roomModel.findOne({
      where: { uid: roomUid, user_uid: user.vpbx_user_uid },
    });
    if (!room) {
      throw conferenceRoomHttpError(
        HttpStatus.NOT_FOUND,
        'CONFERENCE_ROOM_NOT_FOUND',
        `Conference room ${roomUid} not found`,
        { uid: roomUid },
      );
    }

    const createdBy = room.created_by;
    if (createdBy != null && createdBy !== user.sub) {
      await this.loggerService.logAction(
        user.sub,
        'conference_live_room_enter',
        'conference_room',
        roomUid,
        user.vpbx_user_uid,
        `created_by=${createdBy}`,
      );
    }

    return room.toJSON ? room.toJSON() : room;
  }

  async resolveCallerRef(user: { sub: number; vpbx_user_uid: number }): Promise<string | null> {
    if (!this.userModel) return null;
    const row = await this.userModel.findOne({
      where: { uniqueid: user.sub, vpbx_user_uid: user.vpbx_user_uid },
      attributes: ['uniqueid', 'exten', 'login'],
    });
    if (!row) return null;
    const rawExten = (row as { exten?: string }).exten ?? row.getDataValue?.('exten');
    const exten = normalizeAccessToken(rawExten);
    if (exten) return exten;
    const login = String((row as { login?: string }).login ?? row.getDataValue?.('login') ?? '');
    if (/^\d+$/.test(login)) return login;
    return null;
  }

  async getRoomModerators(roomUid: number, vpbx: number) {
    await this.requireTenantRoom(roomUid, vpbx);
    const rows = await this.loadModeratorRows(roomUid);
    return rows.map((row) => ({
      endpointRef: String(row.endpoint_ref),
      role: row.role,
    }));
  }

  async setRoomModerators(
    roomUid: number,
    dto: SetConferenceModeratorsDto,
    vpbx: number,
  ) {
    const room = await this.requireTenantRoom(roomUid, vpbx);
    const moderators = dto.moderators ?? [];
    this.assertModeratorList(moderators);

    if (!this.moderatorModel) {
      throw new Error('ConferenceRoomModerator model is not wired');
    }

    const transaction = await this.sequelize.transaction();
    let committed = false;
    try {
      await this.moderatorModel.destroy({
        where: { room_uid: roomUid },
        transaction,
      });
      if (moderators.length) {
        await this.moderatorModel.bulkCreate(
          moderators.map((item) => ({
            room_uid: roomUid,
            endpoint_ref: item.endpointRef,
            role: item.role,
          })),
          { transaction },
        );
      }
      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      throw e;
    }

    try {
      await this.applyRoom(room, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan apply failed for conference room ${roomUid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }

    return this.getRoomModerators(roomUid, vpbx);
  }

  private assertEntryPolicyConsistent(nextRoomState: ConferenceEntryPolicyRoom): void {
    if (!conferenceEntryPolicy(nextRoomState).pinRequiredButMissing) return;
    throw conferenceRoomHttpError(
      HttpStatus.BAD_REQUEST,
      'CONFERENCE_PIN_REQUIRED',
      'Conference PIN is required for this entry strictness',
    );
  }

  private async requireTenantRoom(roomUid: number, vpbx: number): Promise<ConferenceRoom> {
    const room = await this.roomModel.findOne({
      where: { uid: roomUid, user_uid: vpbx },
    });
    if (!room) {
      throw conferenceRoomHttpError(
        HttpStatus.NOT_FOUND,
        'CONFERENCE_ROOM_NOT_FOUND',
        `Conference room ${roomUid} not found`,
        { uid: roomUid },
      );
    }
    return room;
  }

  private assertModeratorList(moderators: ConferenceModeratorDto[]): void {
    const owners = moderators.filter((item) => item.role === 'owner');
    if (owners.length > 1) {
      throw conferenceRoomHttpError(
        HttpStatus.BAD_REQUEST,
        'CONFERENCE_OWNER_DUPLICATE',
        'A conference room can have only one owner',
      );
    }
    const seen = new Set<string>();
    for (const item of moderators) {
      if (seen.has(item.endpointRef)) {
        throw conferenceRoomHttpError(
          HttpStatus.BAD_REQUEST,
          'CONFERENCE_MODERATOR_DUPLICATE',
          `Duplicate moderator endpoint ${item.endpointRef}`,
          { endpointRef: item.endpointRef },
        );
      }
      seen.add(item.endpointRef);
    }
  }

  private async loadModeratorRows(roomUid: number): Promise<
    Array<{ endpoint_ref: string; role: 'owner' | 'moderator' }>
  > {
    if (!this.moderatorModel) return [];
    const rows = await this.moderatorModel.findAll({
      where: { room_uid: roomUid },
    });
    return rows.map((row) => ({
      endpoint_ref: row.endpoint_ref,
      role: row.role,
    }));
  }

  private toPermanentRights(
    rows: Array<{ endpoint_ref: string; role: 'owner' | 'moderator' }>,
  ): ConferencePermanentRight[] {
    return rows.map((row) => ({
      endpointRef: row.endpoint_ref,
      role: row.role,
    }));
  }

  private syncRoomRights(roomUid: number, rights: ConferencePermanentRight[]): void {
    this.stateService.setRoomRights(roomUid, {
      ownerRef: rights.find((item) => item.role === 'owner')?.endpointRef ?? null,
      moderatorRefs: rights
        .filter((item) => item.role === 'moderator')
        .map((item) => item.endpointRef),
    });
  }

  private async buildMaskIndex(vpbx: number) {
    const rooms = (await this.roomModel.findAll({
      where: { user_uid: vpbx },
      attributes: ['uid', 'number'],
    })) ?? [];
    return generateConferenceMaskIndex(
      rooms.map((room) => ({ uid: room.uid, number: String(room.number) })),
      vpbx,
    );
  }

  private async applyRoom(room: ConferenceRoom, vpbx: number): Promise<void> {
    const rights = this.toPermanentRights(await this.loadModeratorRows(room.uid));
    this.syncRoomRights(room.uid, rights);
    await this.dialplanApplyService.applyCategories(
      this.roomFile(vpbx),
      [generateConferenceDialplan(room, vpbx, rights), await this.buildMaskIndex(vpbx)],
      { reload: true },
    );
  }
}
