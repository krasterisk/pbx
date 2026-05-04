import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TimeGroup } from './time-group.model';
import type { ITimeGroupInterval } from '@krasterisk/shared';

@Injectable()
export class TimeGroupsService {
  private readonly logger = new Logger(TimeGroupsService.name);

  constructor(
    @InjectModel(TimeGroup) private timeGroupModel: typeof TimeGroup,
  ) {}

  async findAll(userUid: number): Promise<TimeGroup[]> {
    return this.timeGroupModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<TimeGroup> {
    const tg = await this.timeGroupModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!tg) throw new NotFoundException('Time group not found');
    return tg;
  }

  async create(data: Partial<TimeGroup>, userUid: number): Promise<TimeGroup> {
    // Prevent tenant override from client
    delete data.user_uid;
    return this.timeGroupModel.create({
      ...data,
      user_uid: userUid,
    } as any);
  }

  async update(uid: number, data: Partial<TimeGroup>, userUid: number): Promise<TimeGroup> {
    const tg = await this.findOne(uid, userUid);
    // Prevent tenant override
    delete data.user_uid;
    await tg.update(data);
    return tg;
  }

  async remove(uid: number, userUid: number): Promise<void> {
    const tg = await this.findOne(uid, userUid);
    await tg.destroy();
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.timeGroupModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }

  /**
   * Generate Asterisk dialplan context for a time group.
   * Pattern from v3: Gosub(tgroup_<uid>,start,1) → ExecIfTime → Set(__WORKTIME_<uid>=1) → Return()
   */
  generateDialplan(timeGroup: TimeGroup): string {
    const lines: string[] = [];
    lines.push(`[tgroup_${timeGroup.uid}]`);
    lines.push(`exten => start,1,NoOp(TimeGroup: ${timeGroup.name})`);
    lines.push(`same => n,Set(__WORKTIME_${timeGroup.uid}=0)`);

    const intervals: ITimeGroupInterval[] = timeGroup.intervals || [];
    for (const interval of intervals) {
      const timeExpr = `${interval.time_start}-${interval.time_end}`;
      const expr = `${timeExpr},${interval.days_of_week},${interval.days_of_month},${interval.months}`;
      lines.push(`same => n,ExecIfTime(${expr}?Set(__WORKTIME_${timeGroup.uid}=1))`);
    }

    lines.push('same => n,Return()');
    return lines.join('\n');
  }
}
