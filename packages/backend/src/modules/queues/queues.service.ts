import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Queue } from './queue.model';
import { QueueMember } from './queue-member.model';
import { AmiService } from '../ami/ami.service';

export interface CreateQueueDto {
  exten: string;
  display_name?: string;
  strategy?: string;
  timeout?: number;
  retry?: number;
  wrapuptime?: number;
  maxlen?: number;
  musiconhold?: string;
  context?: string;
  weight?: number;
  servicelevel?: number;
  joinempty?: string;
  leavewhenempty?: string;
  ringinuse?: boolean;
  // Announcements
  announce?: string;
  announce_frequency?: number;
  announce_holdtime?: string;
  announce_round_seconds?: number;
  periodic_announce?: string;
  periodic_announce_frequency?: number;
  queue_youarenext?: string;
  queue_thereare?: string;
  queue_callswaiting?: string;
  queue_holdtime?: string;
  queue_minutes?: string;
  queue_seconds?: string;
  queue_lessthan?: string;
  queue_thankyou?: string;
  queue_reporthold?: string;
  // Advanced (dynamic key-value)
  advanced?: Record<string, any>;
  // Members
  members?: MemberDto[];
}

export interface UpdateQueueDto extends Partial<CreateQueueDto> {}

export interface MemberDto {
  interface: string;
  membername?: string;
  penalty?: number;
  paused?: number;
  wrapuptime?: number;
  state_interface?: string;
}

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectModel(Queue) private queueModel: typeof Queue,
    @InjectModel(QueueMember) private memberModel: typeof QueueMember,
    private sequelize: Sequelize,
    private amiService: AmiService,
  ) {}

  /** Build globally unique queue name: q{exten}_{vpbxUserUid} */
  private buildQueueName(vpbxUserUid: number, exten: string): string {
    return `q${exten}_${vpbxUserUid}`;
  }

  /** Extract user-facing extension number from queue name */
  private extractExten(queueName: string): string {
    // q700_42 → "700"
    const match = queueName.match(/^q(.+)_\d+$/);
    return match ? match[1] : queueName;
  }

  async findAll(vpbxUserUid: number) {
    const queues = await this.queueModel.findAll({
      where: { vpbx_user_uid: vpbxUserUid },
      order: [['name', 'ASC']],
    });

    // Attach member count for each queue
    const result = [];
    for (const q of queues) {
      const queueName = q.getDataValue('name');
      const memberCount = await this.memberModel.count({
        where: { queue_name: queueName, vpbx_user_uid: vpbxUserUid },
      });
      result.push({
        ...q.toJSON(),
        exten: this.extractExten(queueName),
        memberCount,
      });
    }
    return result;
  }

  async findOne(name: string, vpbxUserUid: number) {
    const queue = await this.queueModel.findOne({
      where: { name, vpbx_user_uid: vpbxUserUid },
    });
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);

    const members = await this.memberModel.findAll({
      where: { queue_name: name, vpbx_user_uid: vpbxUserUid },
      order: [['penalty', 'ASC'], ['uniqueid', 'ASC']],
    });

    return {
      ...queue.toJSON(),
      exten: this.extractExten(queue.getDataValue('name')),
      members: members.map(m => m.toJSON()),
    };
  }

  async create(dto: CreateQueueDto, vpbxUserUid: number) {
    const queueName = this.buildQueueName(vpbxUserUid, dto.exten);

    // Check for duplicate name
    const existing = await this.queueModel.findOne({
      where: { name: queueName, vpbx_user_uid: vpbxUserUid },
    });
    if (existing) throw new ConflictException(`Queue with extension "${dto.exten}" already exists`);

    const transaction = await this.sequelize.transaction();
    try {
      // Extract members and advanced before creating queue
      const { members, advanced, exten, ...queueData } = dto;

      // Merge advanced fields into queue data
      const fullData: any = {
        ...queueData,
        ...(advanced || {}),
        name: queueName,
        vpbx_user_uid: vpbxUserUid,
      };

      const queue = await this.queueModel.create(fullData, { transaction });

      // Create members
      if (members?.length) {
        await this.memberModel.bulkCreate(
          members.map(m => ({
            ...m,
            queue_name: queueName,
            vpbx_user_uid: vpbxUserUid,
          })),
          { transaction },
        );
      }

      await transaction.commit();
      await this.reloadQueues();
      this.logger.log(`Queue "${dto.exten}" (${queueName}) created with ${members?.length || 0} members`);
      return this.findOne(queueName, vpbxUserUid);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async update(name: string, dto: UpdateQueueDto, vpbxUserUid: number) {
    const queue = await this.queueModel.findOne({
      where: { name, vpbx_user_uid: vpbxUserUid },
    });
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);

    const transaction = await this.sequelize.transaction();
    try {
      const { members, advanced, exten, ...queueData } = dto;

      const newQueueName = exten ? this.buildQueueName(vpbxUserUid, exten) : name;
      const isRenaming = newQueueName !== name;

      if (isRenaming) {
        const existing = await this.queueModel.findOne({
          where: { name: newQueueName, vpbx_user_uid: vpbxUserUid },
        });
        if (existing) {
          throw new ConflictException(`Queue with extension "${exten}" already exists`);
        }
      }

      // Merge advanced fields
      const updateData: any = {
        ...queueData,
        ...(advanced || {}),
        ...(isRenaming ? { name: newQueueName } : {}),
      };

      // Remove undefined values
      Object.keys(updateData).forEach(k => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      await queue.update(updateData, { transaction });

      // Sync members if provided
      if (members !== undefined) {
        await this.memberModel.destroy({
          where: { queue_name: name, vpbx_user_uid: vpbxUserUid },
          transaction,
        });
        if (members.length) {
          await this.memberModel.bulkCreate(
            members.map(m => ({
              ...m,
              queue_name: newQueueName,
              vpbx_user_uid: vpbxUserUid,
            })),
            { transaction },
          );
        }
      } else if (isRenaming) {
        // If members weren't passed but queue was renamed, we must manually update queue_name on existing members
        await this.memberModel.update(
          { queue_name: newQueueName },
          { where: { queue_name: name, vpbx_user_uid: vpbxUserUid }, transaction }
        );
      }

      await transaction.commit();
      await this.reloadQueues();
      this.logger.log(`Queue "${name}" updated${isRenaming ? ` and renamed to "${newQueueName}"` : ''}`);
      return this.findOne(newQueueName, vpbxUserUid);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async remove(name: string, vpbxUserUid: number) {
    const queue = await this.queueModel.findOne({
      where: { name, vpbx_user_uid: vpbxUserUid },
    });
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);

    const transaction = await this.sequelize.transaction();
    try {
      await this.memberModel.destroy({
        where: { queue_name: name, vpbx_user_uid: vpbxUserUid },
        transaction,
      });
      await queue.destroy({ transaction });
      await transaction.commit();
      await this.reloadQueues();
      this.logger.log(`Queue "${name}" deleted`);
      return { success: true };
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  private async reloadQueues() {
    try {
      await this.amiService.command('queue reload all');
    } catch (e) {
      this.logger.warn(`Queue reload failed: ${e}`);
    }
  }
}
