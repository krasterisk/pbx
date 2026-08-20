import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, UniqueConstraintError } from 'sequelize';
import { CallGroup } from './call-group.model';
import { CallGroupMember } from './call-group-member.model';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { generateGroupDialplan } from './call-group-dialplan.util';
import {
  CreateCallGroupDto,
  UpdateCallGroupDto,
  CallGroupMemberDto,
} from './dto/call-group.dto';
import type { ICallGroup, ICallGroupMember } from '@krasterisk/shared';
import { EndpointsService } from '../endpoints/endpoints.service';

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
      throw new ConflictException(
        `Call group extension "${exten}" is already used by group "${existing.name}" (uid ${existing.uid})`,
      );
    }

    const [queues] = await this.sequelize.query(
      'SELECT name FROM queue_table WHERE name = :name LIMIT 1',
      { replacements: { name: `q${exten}_${vpbx}` } },
    );
    if (Array.isArray(queues) && queues.length > 0) {
      throw new ConflictException(`Extension "${exten}" is already used by a queue`);
    }

    const endpoints = await this.endpointsService.findAll(vpbx);
    if (endpoints.some((e) => String(e.extension) === exten)) {
      throw new ConflictException(`Extension "${exten}" is already used by an internal number`);
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
      throw new BadRequestException(
        `Unknown extensions for this tenant: ${missing.join(', ')}`,
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
    const category = generateGroupDialplan(
      this.toICallGroup(group),
      this.toIMembers(members),
      vpbx,
      webrtcExtensions,
    );
    await this.dialplanApplyService.applyCategories(
      this.groupFile(vpbx),
      [category],
      { reload: true },
    );
  }

  private async removeGroupContext(uid: number, vpbx: number): Promise<void> {
    await this.dialplanApplyService.deleteCategories(
      this.groupFile(vpbx),
      [`group_${uid}_${vpbx}`],
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
    if (!group) throw new NotFoundException(`Call group ${uid} not found`);

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
      throw new BadRequestException('exten is required');
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
        throw new ConflictException(
          `Call group extension "${dto.exten}" is already used in this tenant`,
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
    if (!group) throw new NotFoundException(`Call group ${uid} not found`);

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
        throw new ConflictException(
          `Call group extension "${dto.exten}" is already used in this tenant`,
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
    if (!group) throw new NotFoundException(`Call group ${uid} not found`);

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
      await this.removeGroupContext(uid, vpbx);
    } catch (e: any) {
      this.logger.error(
        `Dialplan remove failed for call group ${uid} (${this.groupFile(vpbx)}); DB deleted — dialplan may need cleanup: ${e?.message || e}`,
      );
    }
    this.logger.log(`Call group ${uid} deleted`);
    return { success: true };
  }
}
