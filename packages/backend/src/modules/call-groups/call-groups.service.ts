import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, UniqueConstraintError } from 'sequelize';
import { CallGroup } from './call-group.model';
import { CallGroupMember } from './call-group-member.model';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { generateGroupDialplan } from './call-group-dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import {
  CreateCallGroupDto,
  UpdateCallGroupDto,
  CallGroupMemberDto,
} from './dto/call-group.dto';
import type { ICallGroup, ICallGroupMember } from '@krasterisk/shared';
import { EndpointsService } from '../endpoints/endpoints.service';

/** Stable codes for frontend i18n (`callGroups.errors.<code>`). */
export type CallGroupErrorCode =
  | 'CALL_GROUP_EXTEN_REQUIRED'
  | 'CALL_GROUP_EXTEN_USED_BY_GROUP'
  | 'CALL_GROUP_EXTEN_USED_BY_QUEUE'
  | 'CALL_GROUP_EXTEN_USED_BY_ENDPOINT'
  | 'CALL_GROUP_EXTEN_USED_IN_TENANT'
  | 'CALL_GROUP_UNKNOWN_EXTENSIONS'
  | 'CALL_GROUP_NOT_FOUND';

export function callGroupHttpError(
  status: HttpStatus,
  code: CallGroupErrorCode,
  message: string,
  params: Record<string, string | number> = {},
): HttpException {
  const body = { code, message, params };
  if (status === HttpStatus.CONFLICT) return new ConflictException(body);
  if (status === HttpStatus.BAD_REQUEST) return new BadRequestException(body);
  if (status === HttpStatus.NOT_FOUND) return new NotFoundException(body);
  return new HttpException(body, status);
}

@Injectable()
export class CallGroupsService {
  private readonly logger = new Logger(CallGroupsService.name);

  constructor(
    @InjectModel(CallGroup) private readonly groupModel: typeof CallGroup,
    @InjectModel(CallGroupMember) private readonly memberModel: typeof CallGroupMember,
    private readonly sequelize: Sequelize,
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly endpointsService: EndpointsService,
  ) {}

  private groupFile(vpbx: number): string {
    return `krasterisk/groups/group_${vpbx}.conf`;
  }

  /**
   * Tenant-unique group number must not collide with another group, a queue, or an internal.
   */
  private async assertExtenFree(exten: string, vpbx: number, excludeUid?: number): Promise<void> {
    const existing = await this.groupModel.findOne({
      where: {
        user_uid: vpbx,
        exten,
        ...(excludeUid !== undefined ? { uid: { [Op.ne]: excludeUid } } : {}),
      },
    });
    if (existing) {
      throw callGroupHttpError(
        HttpStatus.CONFLICT,
        'CALL_GROUP_EXTEN_USED_BY_GROUP',
        `Call group extension "${exten}" is already used by group "${existing.name}" (uid ${existing.uid})`,
        { exten, name: existing.name, uid: existing.uid },
      );
    }

    const [queues] = await this.sequelize.query(
      'SELECT name FROM queue_table WHERE name = :name LIMIT 1',
      { replacements: { name: `q${exten}_${vpbx}` } },
    );
    if (Array.isArray(queues) && queues.length > 0) {
      throw callGroupHttpError(
        HttpStatus.CONFLICT,
        'CALL_GROUP_EXTEN_USED_BY_QUEUE',
        `Extension "${exten}" is already used by a queue`,
        { exten },
      );
    }

    const endpoints = await this.endpointsService.findAll(vpbx);
    if (endpoints.some((e) => String(e.extension) === exten)) {
      throw callGroupHttpError(
        HttpStatus.CONFLICT,
        'CALL_GROUP_EXTEN_USED_BY_ENDPOINT',
        `Extension "${exten}" is already used by an internal number`,
        { exten },
      );
    }
  }

  /**
   * Internal members must be extensions of this tenant (dialplan uses e{ext}_{vpbx}).
   * Cross-tenant IDs are impossible by construction; unknown locals are rejected.
   */
  private async assertInternalMembersExist(
    members: CallGroupMemberDto[] | undefined,
    vpbx: number,
  ): Promise<void> {
    if (!members?.length) return;
    const internals = members
      .filter((m) => m.member_type === 'internal')
      .map((m) => m.value.trim())
      .filter(Boolean);
    if (!internals.length) return;

    const endpoints = await this.endpointsService.findAll(vpbx);
    const known = new Set(endpoints.map((e) => String(e.extension)));
    const missing = [...new Set(internals.filter((ext) => !known.has(ext)))];
    if (missing.length) {
      throw callGroupHttpError(
        HttpStatus.BAD_REQUEST,
        'CALL_GROUP_UNKNOWN_EXTENSIONS',
        `Unknown extensions for this tenant: ${missing.join(', ')}`,
        { extensions: missing.join(', ') },
      );
    }
  }

  private toICallGroup(group: CallGroup): ICallGroup {
    const json = group.toJSON() as ICallGroup;
    return {
      ...json,
      external_context: json.external_context ?? '',
    };
  }

  private toIMembers(members: CallGroupMember[]): ICallGroupMember[] {
    return members.map((m) => m.toJSON() as ICallGroupMember);
  }

  private async applyGroup(
    group: CallGroup,
    members: CallGroupMember[],
    vpbx: number,
  ): Promise<void> {
    const webrtcExtensions = await this.endpointsService.listWebrtcEnabledExtensions(vpbx);
    const mapped = this.toICallGroup(group);
    const category = generateGroupDialplan(
      mapped,
      this.toIMembers(members),
      vpbx,
      webrtcExtensions,
      {
        confirmExternal: mapped.confirmExternal,
        confirmDigit: mapped.confirmDigit,
        skipBusy: mapped.skipBusy,
        greetingPrompt: mapped.greetingPrompt,
        mohClass: mapped.mohClass,
        useMohInsteadOfRingback: mapped.useMohInsteadOfRingback,
        dialOpts: mapped.dialOptions,
      },
    );
    await this.dialplanApplyService.applyCategories(
      this.groupFile(vpbx),
      [category, ...(category.extras ?? [])],
      { reload: true },
    );
  }

  private async removeGroupContext(group: CallGroup, vpbx: number): Promise<void> {
    const names = [
      normalizeTarget('group', { source: 'fixed', value: group.exten }, vpbx),
      `group_${group.uid}_${vpbx}`,
    ];
    await this.dialplanApplyService.deleteCategories(
      this.groupFile(vpbx),
      [...new Set(names)],
      { reload: true },
    );
  }

  async findAll(vpbx: number) {
    const groups = await this.groupModel.findAll({
      where: { user_uid: vpbx },
      order: [['uid', 'DESC']],
    });

    const result = [];
    for (const group of groups) {
      const members = await this.memberModel.findAll({
        where: { call_group_uid: group.uid, user_uid: vpbx },
        order: [['position', 'ASC'], ['uid', 'ASC']],
      });
      result.push({
        ...group.toJSON(),
        members: members.map((m) => m.toJSON()),
      });
    }
    return result;
  }

  async findOne(uid: number, vpbx: number) {
    const group = await this.groupModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!group) {
      throw callGroupHttpError(
        HttpStatus.NOT_FOUND,
        'CALL_GROUP_NOT_FOUND',
        `Call group ${uid} not found`,
        { uid },
      );
    }

    const members = await this.memberModel.findAll({
      where: { call_group_uid: uid, user_uid: vpbx },
      order: [['position', 'ASC'], ['uid', 'ASC']],
    });

    return {
      ...group.toJSON(),
      members: members.map((m) => m.toJSON()),
    };
  }

  async create(dto: CreateCallGroupDto, vpbx: number) {
    if (!dto.exten) {
      throw callGroupHttpError(
        HttpStatus.BAD_REQUEST,
        'CALL_GROUP_EXTEN_REQUIRED',
        'exten is required',
      );
    }
    const data = { ...dto } as CreateCallGroupDto & { user_uid?: number };
    delete data.user_uid;
    const { members, ...groupData } = data;
    await this.assertExtenFree(dto.exten, vpbx);
    await this.assertInternalMembersExist(members, vpbx);

    const transaction = await this.sequelize.transaction();
    let committed = false;
    let group: CallGroup;
    let createdMembers: CallGroupMember[] = [];
    try {
      group = await this.groupModel.create(
        {
          ...groupData,
          user_uid: vpbx,
        } as Parameters<typeof this.groupModel.create>[0],
        { transaction },
      );

      if (members?.length) {
        createdMembers = await this.memberModel.bulkCreate(
          members.map((m: CallGroupMemberDto) => ({
            member_type: m.member_type,
            value: m.value,
            position: m.position,
            ring_time: m.ring_time ?? 20,
            call_group_uid: group.uid,
            user_uid: vpbx,
          })),
          { transaction },
        );
      }

      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      if (e instanceof UniqueConstraintError || (e as { name?: string })?.name === 'SequelizeUniqueConstraintError') {
        throw callGroupHttpError(
          HttpStatus.CONFLICT,
          'CALL_GROUP_EXTEN_USED_IN_TENANT',
          `Call group extension "${dto.exten}" is already used in this tenant`,
          { exten: dto.exten ?? '' },
        );
      }
      throw e;
    }

    try {
      await this.applyGroup(group, createdMembers, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan apply failed for call group ${group.uid} (${this.groupFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }
    this.logger.log(
      `Call group "${group.name}" (${group.uid}) created with ${createdMembers.length} members`,
    );
    return this.findOne(group.uid, vpbx);
  }

  async update(uid: number, dto: UpdateCallGroupDto, vpbx: number) {
    const group = await this.groupModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!group) {
      throw callGroupHttpError(
        HttpStatus.NOT_FOUND,
        'CALL_GROUP_NOT_FOUND',
        `Call group ${uid} not found`,
        { uid },
      );
    }

    const data = { ...dto } as UpdateCallGroupDto & { user_uid?: number };
    delete data.user_uid;
    const { members, ...groupData } = data;
    if (dto.exten) {
      await this.assertExtenFree(dto.exten, vpbx, uid);
    }
    if (members !== undefined) {
      await this.assertInternalMembersExist(members, vpbx);
    }

    const transaction = await this.sequelize.transaction();
    let committed = false;
    let appliedMembers: CallGroupMember[] = [];
    try {
      const updateData: Record<string, unknown> = { ...groupData };
      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      if (Object.keys(updateData).length) {
        await group.update(updateData, { transaction });
      }

      if (members !== undefined) {
        await this.memberModel.destroy({
          where: { call_group_uid: uid, user_uid: vpbx },
          transaction,
        });
        if (members.length) {
          appliedMembers = await this.memberModel.bulkCreate(
            members.map((m: CallGroupMemberDto) => ({
              member_type: m.member_type,
              value: m.value,
              position: m.position,
              ring_time: m.ring_time ?? 20,
              call_group_uid: uid,
              user_uid: vpbx,
            })),
            { transaction },
          );
        } else {
          appliedMembers = [];
        }
      } else {
        appliedMembers = await this.memberModel.findAll({
          where: { call_group_uid: uid, user_uid: vpbx },
          transaction,
        });
      }

      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      if (e instanceof UniqueConstraintError || (e as { name?: string })?.name === 'SequelizeUniqueConstraintError') {
        throw callGroupHttpError(
          HttpStatus.CONFLICT,
          'CALL_GROUP_EXTEN_USED_IN_TENANT',
          `Call group extension "${dto.exten}" is already used in this tenant`,
          { exten: dto.exten ?? '' },
        );
      }
      throw e;
    }

    try {
      await this.applyGroup(group, appliedMembers, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan apply failed for call group ${uid} (${this.groupFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }
    this.logger.log(`Call group ${uid} updated`);
    return this.findOne(uid, vpbx);
  }

  async remove(uid: number, vpbx: number) {
    const group = await this.groupModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!group) {
      throw callGroupHttpError(
        HttpStatus.NOT_FOUND,
        'CALL_GROUP_NOT_FOUND',
        `Call group ${uid} not found`,
        { uid },
      );
    }

    const transaction = await this.sequelize.transaction();
    let committed = false;
    try {
      await this.memberModel.destroy({
        where: { call_group_uid: uid, user_uid: vpbx },
        transaction,
      });
      await group.destroy({ transaction });
      await transaction.commit();
      committed = true;
    } catch (e) {
      if (!committed) await transaction.rollback();
      throw e;
    }

    try {
      await this.removeGroupContext(group, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan remove failed for call group ${uid} (${this.groupFile(vpbx)}); DB deleted — dialplan may need cleanup: ${e?.message || e}`,
      );
    }
    this.logger.log(`Call group ${uid} deleted`);
    return { success: true };
  }
}
