import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
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

@Injectable()
export class CallGroupsService {
  private readonly logger = new Logger(CallGroupsService.name);

  constructor(
    @InjectModel(CallGroup) private readonly groupModel: typeof CallGroup,
    @InjectModel(CallGroupMember) private readonly memberModel: typeof CallGroupMember,
    private readonly sequelize: Sequelize,
    private readonly dialplanApplyService: DialplanApplyService,
  ) {}

  private groupFile(vpbx: number): string {
    return `krasterisk/groups/group_${vpbx}.conf`;
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
    const category = generateGroupDialplan(
      this.toICallGroup(group),
      this.toIMembers(members),
      vpbx,
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
    const data = { ...dto } as CreateCallGroupDto & { user_uid?: number };
    delete data.user_uid;
    const { members, ...groupData } = data;

    const transaction = await this.sequelize.transaction();
    try {
      const group = await this.groupModel.create(
        {
          ...groupData,
          user_uid: vpbx,
        } as Parameters<typeof this.groupModel.create>[0],
        { transaction },
      );

      let createdMembers: CallGroupMember[] = [];
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

      await this.applyGroup(group, createdMembers, vpbx);
      this.logger.log(
        `Call group "${group.name}" (${group.uid}) created with ${createdMembers.length} members`,
      );
      return this.findOne(group.uid, vpbx);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async update(uid: number, dto: UpdateCallGroupDto, vpbx: number) {
    const group = await this.groupModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!group) throw new NotFoundException(`Call group ${uid} not found`);

    const data = { ...dto } as UpdateCallGroupDto & { user_uid?: number };
    delete data.user_uid;
    const { members, ...groupData } = data;

    const transaction = await this.sequelize.transaction();
    try {
      const updateData: Record<string, unknown> = { ...groupData };
      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      if (Object.keys(updateData).length) {
        await group.update(updateData, { transaction });
      }

      let appliedMembers: CallGroupMember[];
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

      await this.applyGroup(group, appliedMembers, vpbx);
      this.logger.log(`Call group ${uid} updated`);
      return this.findOne(uid, vpbx);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async remove(uid: number, vpbx: number) {
    const group = await this.groupModel.findOne({
      where: { uid, user_uid: vpbx },
    });
    if (!group) throw new NotFoundException(`Call group ${uid} not found`);

    const transaction = await this.sequelize.transaction();
    try {
      await this.memberModel.destroy({
        where: { call_group_uid: uid, user_uid: vpbx },
        transaction,
      });
      await group.destroy({ transaction });
      await transaction.commit();

      await this.removeGroupContext(uid, vpbx);
      this.logger.log(`Call group ${uid} deleted`);
      return { success: true };
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
}
