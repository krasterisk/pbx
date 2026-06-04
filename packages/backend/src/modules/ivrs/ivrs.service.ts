import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { IIvrPhrase } from '@krasterisk/shared';
import { Ivr } from './ivr.model';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import {
  normalizeIvrPrompts,
  assertIvrPromptsForSave,
  IvrPromptsValidationError,
} from './ivr-prompts.util';

@Injectable()
export class IvrsService {
  private readonly logger = new Logger(IvrsService.name);

  constructor(
    @InjectModel(Ivr) private ivrModel: typeof Ivr,
  ) {}

  private normalizeAndValidatePrompts(raw: unknown): IIvrPhrase[] {
    const prompts = normalizeIvrPrompts(raw);
    try {
      assertIvrPromptsForSave(prompts);
    } catch (e) {
      if (e instanceof IvrPromptsValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
    return prompts;
  }

  private mapIvrForResponse(ivr: Ivr): Ivr {
    const json = ivr.toJSON() as Ivr;
    json.prompts = normalizeIvrPrompts(json.prompts) as any;
    return json as Ivr;
  }

  async findAll(vpbxUserUid: number): Promise<Ivr[]> {
    const rows = await this.ivrModel.findAll({
      where: { user_uid: vpbxUserUid },
      order: [['uid', 'DESC']],
    });
    return rows.map((r) => this.mapIvrForResponse(r));
  }

  async findOne(uid: number, vpbxUserUid: number): Promise<Ivr> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');
    return this.mapIvrForResponse(ivr);
  }

  async create(data: Partial<Ivr>, vpbxUserUid: number): Promise<Ivr> {
    const prompts = data.prompts !== undefined
      ? this.normalizeAndValidatePrompts(data.prompts)
      : [];

    const created = await this.ivrModel.create({
      ...data,
      prompts,
      user_uid: vpbxUserUid,
    } as any);
    return this.mapIvrForResponse(created);
  }

  async update(uid: number, data: Partial<Ivr>, vpbxUserUid: number): Promise<Ivr> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');

    const patch = { ...data } as Partial<Ivr>;
    if (data.prompts !== undefined) {
      patch.prompts = this.normalizeAndValidatePrompts(data.prompts) as any;
    }

    await ivr.update(patch);
    return this.mapIvrForResponse(ivr);
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');
    await ivr.destroy();
  }

  /**
   * Generates the dialplan configuration for a specific IVR.
   */
  generateIvrDialplan(ivr: Ivr, vpbxUserUid: number, isAdmin: boolean = false): string {
    const lines: string[] = [];
    lines.push(`[ivr_${ivr.uid}]`);
    lines.push(`exten => start,1,NoOp(IVR: ${ivr.name})`);
    lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);

    if (ivr.timeout) {
      lines.push(`same => n,Set(TIMEOUT(digit)=${ivr.timeout})`);
      lines.push(`same => n,Set(TIMEOUT(response)=${ivr.timeout})`);
    }

    if (ivr.max_count > 0) {
      lines.push(`same => n,ExecIf($["\${step${ivr.uid}}" = ""]?Set(__step${ivr.uid}=0))`);
      lines.push(`same => n,Set(__step${ivr.uid}=$[\${step${ivr.uid}} + 1])`);
      lines.push(`same => n,ExecIf($[\${step${ivr.uid}} >= ${ivr.max_count}]?goto(ivr_${ivr.uid},max,1))`);
    }

    const phrases = normalizeIvrPrompts(ivr.prompts);
    const baseUrl = AsteriskDialplanUtils.backendBaseUrl;
    const apiKey = AsteriskDialplanUtils.dialplanApiKey;

    phrases.forEach((phrase, index) => {
      if (phrase.kind === 'audio') {
        const filename = AsteriskDialplanUtils.sanitizeFilePath(phrase.filename);
        if (filename) {
          lines.push(`same => n,Background(/usr/records/${vpbxUserUid}/sounds/${filename})`);
        }
        return;
      }

      if (phrase.kind === 'tts' && phrase.engine_uid > 0) {
        const params = new URLSearchParams({
          ivr_uid: String(ivr.uid),
          phrase_index: String(index),
          vpbx_user_uid: String(vpbxUserUid),
          uniqueid: '${UNIQUEID}',
        });
        if (apiKey) {
          params.set('api_key', apiKey);
        }
        const url = `${baseUrl}/internal/ivr/play-phrase?${params.toString()}`;
        lines.push(`same => n,Set(IVR_TTS_PATH=\${CURL(${url})})`);
        lines.push(`same => n,ExecIf($["\${IVR_TTS_PATH}" = ""|"\${IVR_TTS_PATH}" = "0"]?NoOp(IVR TTS failed idx ${index}))`);
        lines.push(`same => n,Background(\${IVR_TTS_PATH})`);
      }
    });

    if (ivr.timeout) {
      lines.push(`same => n,WaitExten(${ivr.timeout})`);
    } else {
      lines.push(`same => n,WaitExten(5)`);
    }

    lines.push('');

    const menuItems = ivr.menu_items || [];
    for (const item of menuItems) {
      const exten = item.digit || 'i';
      const actions = item.actions || [];
      lines.push(`exten => ${exten},1,NoOp(IVR choice: ${exten})`);

      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin);
        if (dp) lines.push(`same => n,${dp}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  async bulkRemove(uids: number[], vpbxUserUid: number): Promise<{ deleted: number }> {
    const deleted = await this.ivrModel.destroy({
      where: { uid: uids, user_uid: vpbxUserUid },
    });
    return { deleted };
  }
}
