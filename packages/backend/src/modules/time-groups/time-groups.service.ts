import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { stateFingerprint, timeGroupState } from '../ai-platform/ai-state-fingerprint';
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TimeGroup } from './time-group.model';
import type { ITimeGroupInterval } from '@krasterisk/shared';
import { formatTimeGroupInterval } from '../../shared/utils/dialplan.util';

@Injectable()
export class TimeGroupsService {
  private readonly logger = new Logger(TimeGroupsService.name);

  constructor(
    @InjectModel(TimeGroup) private timeGroupModel: typeof TimeGroup,
    @Optional() private readonly tenantSettings?:TenantSettingsService,
  ) {}

  async timezone(userUid:number):Promise<string> {
    const settings=this.tenantSettings?await this.tenantSettings.getAll(userUid):{};
    const zone=settings.timezone??settings.time_zone??'Europe/Moscow';
    if(typeof zone!=='string'||!/^[A-Za-z0-9_+/-]{1,80}$/.test(zone))throw new BadRequestException('Invalid tenant timezone');try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{throw new BadRequestException('Invalid tenant timezone');}return zone;
  }
  private validateIntervals(data:Partial<TimeGroup>):void {
    if(data.intervals===undefined)return;
    if(!Array.isArray(data.intervals)||!data.intervals.length||data.intervals.length>32)throw new BadRequestException('Invalid calendar intervals');
    for(const interval of data.intervals){
      if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.time_start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.time_end))throw new BadRequestException('Invalid calendar time');
      if([interval.days_of_week,interval.days_of_month,interval.months].some(v=>typeof v!=='string'||!v||!/^[0-9a-z*,&-]+$/i.test(v)))throw new BadRequestException('Invalid calendar range');
      try{formatTimeGroupInterval(interval);}catch{throw new BadRequestException('Invalid calendar interval');}
    }
  }
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
    delete data.user_uid;this.validateIntervals(data);
    return this.timeGroupModel.create({
      ...data,
      user_uid: userUid,
    } as any);
  }

  async update(uid: number, data: Partial<TimeGroup>, userUid: number, expectedStateHash?: string): Promise<TimeGroup> {
    delete data.user_uid;this.validateIntervals(data);
    const db = this.timeGroupModel.sequelize;
    const save = async (transaction?: any) => {
      const tg = transaction ? await this.timeGroupModel.findOne({where:{uid,user_uid:userUid},transaction,lock:transaction.LOCK.UPDATE}) : await this.findOne(uid,userUid);
      if (!tg) throw new NotFoundException('Time group not found');
      if (expectedStateHash && stateFingerprint(timeGroupState(tg)) !== expectedStateHash) throw new ConflictException('Time group changed after approval');
      await tg.update(data, transaction ? {transaction} : undefined); return tg;
    };
    return db ? db.transaction(save) : save();
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
    for (const [index,interval] of intervals.entries()) {
      const expr = formatTimeGroupInterval(interval,'Europe/Moscow');
      const label=`wt_${timeGroup.uid}_${index}`;
      lines.push(`same => n,GotoIfTime(${expr}?${label}_open:${label}_done)`);
      lines.push(`same => n(${label}_open),Set(__WORKTIME_${timeGroup.uid}=1)`);
      lines.push(`same => n(${label}_done),NoOp(Calendar interval checked)`);
    }

    lines.push('same => n,Return()');
    return lines.join('\n');
  }
}
