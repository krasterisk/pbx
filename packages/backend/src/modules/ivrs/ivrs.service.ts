import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { IIvrPhrase, IvrPromptsValidationEngine } from '@krasterisk/shared';
import { Ivr } from './ivr.model';
import { TtsEnginesService } from '../tts-engines/tts-engines.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { AsteriskDialplanUtils, prefixSamePriority, renderActionChain } from '../../shared/utils/dialplan.util';
import {
  normalizeIvrPrompts,
  assertIvrPromptsForSave,
  IvrPromptsValidationError,
} from './ivr-prompts.util';
import { resolveIvrTimeouts } from './ivr-timeouts.util';
import { throwIfInvalidActionPayload } from '../../shared/pipes/action-params-validation.util';
import { normalizeIvrMenuItems, summarizeIvrMenu } from './ivr-menu-actions.util';

@Injectable()
export class IvrsService {
  private readonly logger = new Logger(IvrsService.name);

  constructor(
    @InjectModel(Ivr) private ivrModel: typeof Ivr,
    private readonly ttsEnginesService: TtsEnginesService,
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly routeReferencesService: RouteReferencesService,
  ) {}

  /** Per-tenant IVR dialplan file under krasterisk/ivrs/ (two levels deep for Asterisk include glob). */
  private ivrFile(vpbxUserUid: number): string {
    return `krasterisk/ivrs/ivr_${vpbxUserUid}.conf`;
  }

  private ivrCategoryName(uid: number): string {
    return `ivr_${uid}`;
  }

  private async loadEnginesForPrompts(
    prompts: IIvrPhrase[],
    vpbxUserUid: number,
  ): Promise<IvrPromptsValidationEngine[]> {
    const engines: IvrPromptsValidationEngine[] = [];
    for (const p of prompts) {
      if (p.kind !== 'tts' || !p.engine_uid || p.engine_uid <= 0) continue;
      if (engines.some((e) => e.uid === p.engine_uid)) continue;
      const engine = await this.ttsEnginesService.findOne(p.engine_uid, vpbxUserUid);
      engines.push({
        uid: engine.uid,
        type: engine.type,
        settings: engine.settings,
      });
    }
    return engines;
  }

  private async normalizeAndValidatePrompts(
    raw: unknown,
    vpbxUserUid: number,
  ): Promise<IIvrPhrase[]> {
    const prompts = normalizeIvrPrompts(raw);
    const engines = await this.loadEnginesForPrompts(prompts, vpbxUserUid);
    try {
      assertIvrPromptsForSave(prompts, { engines });
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

  /**
   * Write `[ivr_{uid}]` via AMI when active; remove category when inactive.
   * DB is already saved — dialplan failures are logged, not thrown (same as call groups).
   */
  private async syncIvrDialplan(
    ivr: Ivr,
    vpbxUserUid: number,
    isAdmin: boolean = false,
  ): Promise<void> {
    const file = this.ivrFile(vpbxUserUid);
    const category = this.ivrCategoryName(ivr.uid);
    try {
      if (ivr.active === 0) {
        await this.dialplanApplyService.deleteCategories(file, [category], { reload: true });
        return;
      }
      const dialplan = this.generateIvrDialplan(ivr, vpbxUserUid, isAdmin);
      await this.dialplanApplyService.applyCategories(
        file,
        [{ name: category, lines: dialplan.split('\n') }],
        { reload: true },
      );
    } catch (e: any) {
      this.logger.error(
        `Dialplan sync failed for IVR ${ivr.uid} (${file}); DB saved — retry/re-save may be needed: ${e?.message || e}`,
      );
    }
  }

  private async removeIvrDialplan(uid: number, vpbxUserUid: number): Promise<void> {
    const file = this.ivrFile(vpbxUserUid);
    try {
      await this.dialplanApplyService.deleteCategories(
        file,
        [this.ivrCategoryName(uid)],
        { reload: true },
      );
    } catch (e: any) {
      this.logger.error(
        `Dialplan remove failed for IVR ${uid} (${file}); DB deleted — dialplan may need cleanup: ${e?.message || e}`,
      );
    }
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

  async create(
    data: Partial<Ivr>,
    vpbxUserUid: number,
    isAdmin: boolean = false,
  ): Promise<Ivr> {
    const { user_uid: incomingUserUid, menu_items: rawMenu, prompts: rawPrompts, ...rest } = data as Partial<Ivr> & {
      user_uid?: number;
    };
    if (incomingUserUid != null && Number(incomingUserUid) !== Number(vpbxUserUid)) {
      this.logger.warn(`IVR create ignored payload user_uid=${incomingUserUid}, using tenant=${vpbxUserUid}`);
    }

    const prompts = rawPrompts !== undefined
      ? await this.normalizeAndValidatePrompts(rawPrompts, vpbxUserUid)
      : [];
    const menuItems = rawMenu !== undefined
      ? this.normalizeMenuForWrite(rawMenu, vpbxUserUid, 'create')
      : undefined;

    const created = await this.ivrModel.create({
      ...rest,
      ...(menuItems !== undefined ? { menu_items: menuItems } : {}),
      prompts,
      user_uid: vpbxUserUid,
    } as any);

    this.logger.log(
      `IVR created uid=${created.uid} tenant=${vpbxUserUid} active=${created.active} menu=${summarizeIvrMenu(created.menu_items)}`,
    );
    await this.syncIvrDialplan(created, vpbxUserUid, isAdmin);
    return this.mapIvrForResponse(created);
  }

  async update(
    uid: number,
    data: Partial<Ivr>,
    vpbxUserUid: number,
    isAdmin: boolean = false,
  ): Promise<Ivr> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');

    const { user_uid: incomingUserUid, ...safe } = data as Partial<Ivr> & { user_uid?: number };
    if (incomingUserUid != null && Number(incomingUserUid) !== Number(vpbxUserUid)) {
      this.logger.warn(`IVR update uid=${uid} ignored payload user_uid=${incomingUserUid}, tenant=${vpbxUserUid}`);
    }

    const patch = { ...safe } as Partial<Ivr>;
    if (data.prompts !== undefined) {
      patch.prompts = await this.normalizeAndValidatePrompts(data.prompts, vpbxUserUid) as any;
    }
    if (data.menu_items !== undefined) {
      patch.menu_items = this.normalizeMenuForWrite(data.menu_items, vpbxUserUid, `update uid=${uid}`) as any;
    }

    await ivr.update(patch);
    await this.syncIvrDialplan(ivr, vpbxUserUid, isAdmin);
    return this.mapIvrForResponse(ivr);
  }

  async getUsage(uid: number, vpbxUserUid: number) {
    await this.findOne(uid, vpbxUserUid);
    return this.routeReferencesService.findUsage('ivr', uid, vpbxUserUid);
  }

  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const ivr = await this.ivrModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!ivr) throw new NotFoundException('IVR not found');
    await this.routeReferencesService.assertNotReferenced(
      'ivr',
      uid,
      vpbxUserUid,
      'IVR is referenced and cannot be deleted',
    );
    await ivr.destroy();
    await this.removeIvrDialplan(uid, vpbxUserUid);
  }

  /**
   * Generates the dialplan configuration for a specific IVR.
   */
  generateIvrDialplan(ivr: Ivr, vpbxUserUid: number, isAdmin: boolean = false): string {
    const lines: string[] = [];
    const safeName = AsteriskDialplanUtils.sanitizeDialplanInput(ivr.name) || String(ivr.uid);
    lines.push(`[ivr_${ivr.uid}]`);
    lines.push(`exten => start,1,NoOp(IVR: ${safeName})`);
    lines.push(`same => n,Answer()`);
    lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);

    const timeouts = resolveIvrTimeouts(ivr);
    lines.push(`same => n,Set(TIMEOUT(digit)=${timeouts.digit})`);
    lines.push(`same => n,Set(TIMEOUT(response)=${timeouts.response})`);

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

    lines.push(`same => n,WaitExten(${timeouts.waitExten})`);

    lines.push('');

    const healed = normalizeIvrMenuItems(ivr.menu_items, vpbxUserUid);
    if (healed.aliases.length) {
      this.logger.warn(
        `IVR ${ivr.uid} tenant=${vpbxUserUid} healed action aliases at dialplan render: ${JSON.stringify(healed.aliases)}`,
      );
    }
    if (healed.unmapped.length) {
      this.logger.warn(
        `IVR ${ivr.uid} tenant=${vpbxUserUid} unknown action types at dialplan render: ${JSON.stringify(healed.unmapped)}`,
      );
    }

    const menuItems = healed.items;
    const menuExtens = new Set<string>();
    for (const item of menuItems) {
      const rawDigit = String(item.digit ?? 'i');
      const exten = AsteriskDialplanUtils.sanitizeDialplanInput(rawDigit) || 'i';
      menuExtens.add(exten);
      const actions = item.actions || [];
      lines.push(`exten => ${exten},1,NoOp(IVR choice: ${exten})`);

      const dp = renderActionChain(actions, { vpbxUserUid, host: 'ivr', isAdmin });
      if (dp) lines.push(prefixSamePriority(dp));
      lines.push('');
    }

    // Fallback only when menu does not already define "max" (user handler wins).
    if (ivr.max_count > 0 && !menuExtens.has('max')) {
      lines.push(`exten => max,1,NoOp(IVR max retries: ${safeName})`);
      lines.push(`same => n,Hangup()`);
      lines.push('');
    }

    const rendered = lines.join('\n');
    this.logger.debug(
      `IVR ${ivr.uid} tenant=${vpbxUserUid} dialplan ${lines.length} lines menu=${summarizeIvrMenu(menuItems)}`,
    );
    return rendered;
  }

  private normalizeMenuForWrite(raw: unknown, vpbxUserUid: number, context: string) {
    const normalized = normalizeIvrMenuItems(raw, vpbxUserUid);
    if (normalized.aliases.length) {
      this.logger.warn(
        `IVR ${context} tenant=${vpbxUserUid} rewritten action types: ${JSON.stringify(normalized.aliases)}`,
      );
    }
    if (normalized.unmapped.length) {
      this.logger.warn(
        `IVR ${context} tenant=${vpbxUserUid} refused unknown action types: ${JSON.stringify(normalized.unmapped)}`,
      );
      throw new BadRequestException(
        `Unknown IVR action type: ${normalized.unmapped.map((row) => row.type).join(', ')}. Use DialplanAppsEditor types: toexten, togroup, toqueue, toivr, toroute, totrunk, voicemail, hangup, playback.`,
      );
    }
    throwIfInvalidActionPayload({ menu_items: normalized.items });
    this.logger.log(`IVR ${context} tenant=${vpbxUserUid} menu=${summarizeIvrMenu(normalized.items)}`);
    return normalized.items;
  }

  async bulkRemove(uids: number[], vpbxUserUid: number): Promise<{ deleted: number }> {
    await this.routeReferencesService.assertNotReferenced(
      'ivr',
      uids,
      vpbxUserUid,
      'IVR is referenced and cannot be deleted',
    );
    const deleted = await this.ivrModel.destroy({
      where: { uid: uids, user_uid: vpbxUserUid },
    });

    if (deleted > 0 && uids.length > 0) {
      const file = this.ivrFile(vpbxUserUid);
      const categories = uids.map((uid) => this.ivrCategoryName(uid));
      try {
        await this.dialplanApplyService.deleteCategories(file, categories, { reload: true });
      } catch (e: any) {
        const ids = uids.join(',');
        this.logger.error(
          `Dialplan bulk remove failed for IVRs [${ids}] (${file}); DB deleted - dialplan may need cleanup: ${e?.message || e}`,
        );
      }
    }

    return { deleted };
  }
}
