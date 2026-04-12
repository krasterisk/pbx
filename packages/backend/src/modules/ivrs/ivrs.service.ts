import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Ivr } from './ivr.model';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';

@Injectable()
export class IvrsService {
  private readonly logger = new Logger(IvrsService.name);

  constructor(
    @InjectModel(Ivr) private ivrModel: typeof Ivr,
  ) {}

  async findAll(vpbxUserUid: number): Promise<Ivr[]> {
    return this.ivrModel.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, vpbxUserUid: number): Promise<Ivr> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');
    return ivr;
  }

  async create(data: Partial<Ivr>, vpbxUserUid: number): Promise<Ivr> {
    return this.ivrModel.create({
      ...data,
      user_uid: vpbxUserUid,
    } as any);
  }

  async update(uid: number, data: Partial<Ivr>, vpbxUserUid: number): Promise<Ivr> {
    const ivr = await this.findOne(uid, vpbxUserUid);
    await ivr.update(data);
    return ivr;
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const ivr = await this.findOne(uid, vpbxUserUid);
    await ivr.destroy();
  }

  /**
   * Generates the dialplan configuration for a specific IVR.
   */
  generateIvrDialplan(ivr: Ivr, vpbxUserUid: number): string {
    const lines: string[] = [];
    lines.push(`[ivr_${ivr.uid}]`);
    lines.push(`exten => start,1,NoOp(IVR: ${ivr.name})`);
    lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);
    
    if (ivr.timeout) {
      lines.push(`same => n,Set(TIMEOUT(digit)=${ivr.timeout})`);
      lines.push(`same => n,Set(TIMEOUT(response)=${ivr.timeout})`);
    }

    // Max count tracking
    if (ivr.max_count > 0) {
      lines.push(`same => n,ExecIf($["\${step${ivr.uid}}" = ""]?Set(__step${ivr.uid}=0))`);
      lines.push(`same => n,Set(__step${ivr.uid}=$[\${step${ivr.uid}} + 1])`);
      lines.push(`same => n,ExecIf($[\${step${ivr.uid}} >= ${ivr.max_count}]?goto(ivr_${ivr.uid},max,1))`);
    }

    const prompts = ivr.prompts || [];
    for (const p of prompts) {
      if (p.startsWith('tts:')) {
        const text = p.substring(4);
        lines.push(`same => n,AGI(say_bg.php,"${text.replace(/"/g, '\\"')}")`);
      } else {
        lines.push(`same => n,Background(/usr/records/${vpbxUserUid}/sounds/${p})`);
      }
    }

    if (ivr.timeout) {
      lines.push(`same => n,WaitExten(${ivr.timeout})`);
    } else {
      lines.push(`same => n,WaitExten(5)`);
    }

    lines.push('');

    // Generate menu items (extensions)
    const menuItems = ivr.menu_items || [];
    for (const item of menuItems) {
      const exten = item.digit || 'i';
      const actions = item.actions || [];
      lines.push(`exten => ${exten},1,NoOp(IVR choice: ${exten})`);
      
      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid);
        if (dp) lines.push(`same => n,${dp}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

}
