import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createHash } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { VoiceRobot } from './voice-robot.model';
import { VoiceRobotKeywordGroup } from './keyword-group.model';
import { VoiceRobotKeyword } from './keyword.model';
import { VoiceRobotDataList } from './data-list.model';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { DataListSearchService } from './services/data-list-search.service';
import { mapPortableAction, requireScenario, type ScenarioFile } from './voice-robot-scenario';
import { redactSecrets, assertNoSecretArgs } from '../ai-platform/ai-secret-redaction';
import { assertNoTenantAliases } from '../ai-platform/ai-mutation.contract';

export const ROBOT_SETTING_KEYS = ['name', 'description', 'active', 'language', 'stt_engine_id', 'tts_engine_id',
  'greeting_tts_text', 'initial_group_id', 'vad_config', 'max_conversation_steps', 'silence_timeout_seconds',
  'max_inactivity_repeats', 'tts_mode', 'stt_mode', 'tts_cache_max_age_days', 'fallback_bot_action', 'max_retries_bot_action'] as const;
function plain(row: any): any { return typeof row?.toJSON === 'function' ? row.toJSON() : row; }
function pickSettings(row: any): Record<string, any> { return Object.fromEntries(ROBOT_SETTING_KEYS.map(k => [k, row[k] ?? null])); }
function stable(value: any): any { return Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value; }
export function robotRevision(value: unknown) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
export function redactRobotSecrets<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value));
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.webhookAuth?.customHeaders) node.webhookAuth.customHeaders = node.webhookAuth.customHeaders.map((h: any) => ({ key: h.key, value: h.value ? '[REDACTED]' : '' }));
    for (const child of Object.values(node)) walk(child);
  };
  walk(clone); return redactSecrets(clone);
}

/** Model writes for AI/MCP only: allowlisted inputs, tenant ownership, transaction, no PBX reload. */
@Injectable()
export class VoiceRobotConfigurationService {
  constructor(@InjectModel(VoiceRobot) private readonly robots: typeof VoiceRobot,
    @InjectModel(VoiceRobotKeywordGroup) private readonly groups: typeof VoiceRobotKeywordGroup,
    @InjectModel(VoiceRobotKeyword) private readonly keywords: typeof VoiceRobotKeyword,
    @InjectModel(VoiceRobotDataList) private readonly lists: typeof VoiceRobotDataList,
    private readonly providers: AiProvidersService, private readonly references: RouteReferencesService,
    private readonly search: DataListSearchService) {}

  private async ownedRobot(tenant: number, uid: number, transaction?: Transaction, lock = false) {
    const row = await this.robots.findOne({ where: { uid, user_uid: tenant }, transaction,
      ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!row) throw new NotFoundException('Robot not found');
    return row;
  }
  async parentId(operation: string, args: Record<string, any>, tenant: number): Promise<number | null> {
    if (operation === 'create_voice_robot') return null;
    if (args.robotId != null) { await this.ownedRobot(tenant, args.robotId); return args.robotId; }
    if (operation.includes('keyword_group') || operation === 'create_voice_robot_keyword') {
      const row = await this.groups.findOne({ where: { uid: args.groupId ?? args.uid, user_uid: tenant } });
      if (!row) throw new NotFoundException('Keyword group not found');
      await this.ownedRobot(tenant, row.robot_id); return row.robot_id;
    }
    if (operation.includes('keyword')) {
      const kw = await this.keywords.findOne({ where: { uid: args.uid, user_uid: tenant } });
      if (!kw) throw new NotFoundException('Keyword not found');
      return this.parentId('update_voice_robot_keyword_group', { uid: kw.group_id }, tenant);
    }
    if (operation.includes('data_list')) {
      const list = await this.lists.findOne({ where: { uid: args.uid, user_uid: tenant } });
      if (!list) throw new NotFoundException('Data list not found');
      await this.ownedRobot(tenant, list.robot_id); return list.robot_id;
    }
    await this.ownedRobot(tenant, args.uid); return args.uid;
  }
  private async snapshot(tenant: number, uid: number, transaction?: Transaction): Promise<{ robot: Record<string, any>; groups: any[]; keywords: any[]; dataLists: any[] }> {
    const robot = plain(await this.ownedRobot(tenant, uid, transaction));
    const lock = transaction ? { lock: transaction.LOCK.UPDATE } : {};
    const groups = (await this.groups.findAll({ where: { robot_id: uid, user_uid: tenant }, order: [['uid', 'ASC']], transaction, ...lock })).map(plain);
    const keywords: any[] = [];
    for (const group of groups) keywords.push(...(await this.keywords.findAll({ where: { group_id: group.uid, user_uid: tenant }, order: [['uid', 'ASC']], transaction, ...lock })).map(plain));
    const dataLists = (await this.lists.findAll({ where: { robot_id: uid, user_uid: tenant }, order: [['uid', 'ASC']], transaction, ...lock })).map(plain);
    return { robot: { uid, ...pickSettings(robot) }, groups, keywords, dataLists };
  }
  async revision(operation: string, args: Record<string, any>, tenant: number) {
    const uid = await this.parentId(operation, args, tenant);
    return uid == null ? 'new' : robotRevision(await this.snapshot(tenant, uid));
  }
  async configuration(tenant: number, uid: number) {
    const snapshot = await this.snapshot(tenant, uid);
    return redactRobotSecrets({ ...snapshot, revision: robotRevision(snapshot), scenario: this.toPortable(snapshot) });
  }
  async exportScenario(tenant: number, uid: number) {
    const file = this.toPortable(await this.snapshot(tenant, uid));
    // Export is model-visible: credentials in action auth are deliberately removed, never substituted with a usable-looking token.
    for (const group of file.scenario.groups) for (const kw of group.keywords) for (const action of [kw.bot_action, kw.escalation_action]) this.removeAuth(action);
    this.removeAuth(file.scenario.fallbackBotAction); this.removeAuth(file.scenario.maxRetriesBotAction);
    return { file, webhookAuthRemoved: true };
  }
  private removeAuth(action: any) { if (action?.webhookAuth) action.webhookAuth = { mode: 'none' }; }
  private toPortable(snapshot: any): ScenarioFile {
    const outAction = (action: any): any => {
      if (!action) return null;
      const next = (state: any) => state && ({ ...state, ...(state.type === 'switch_group' ? { target: `group:${state.target}` } : {}) });
      const { dataListSearch: search, ...rest } = action;
      const { listId, ...searchRest } = search ?? {};
      return { ...rest, nextState: next(rest.nextState), ...(search ? { dataListSearch: { ...searchRest, listKey: `list:${listId}`,
        onFoundNextState: next(search.onFoundNextState), notFoundNextState: next(search.notFoundNextState) } } : {}) };
    };
    const r = snapshot.robot;
    return { format: 'krasterisk.voice-robot.scenario', version: 1, exportedAt: new Date().toISOString(), scenario: {
      greetingTtsText: r.greeting_tts_text, initialGroupKey: r.initial_group_id ? `group:${r.initial_group_id}` : null,
      fallbackBotAction: outAction(r.fallback_bot_action), maxRetriesBotAction: outAction(r.max_retries_bot_action),
      dataLists: snapshot.dataLists.map((list: any) => ({ key: `list:${list.uid}`, name: list.name, description: list.description ?? null, columns: list.columns, rows: list.rows })),
      groups: snapshot.groups.map((g: any) => ({ key: `group:${g.uid}`, name: g.name, description: g.description ?? null,
        priority: g.priority, active: !!g.active, is_global: !!g.is_global,
        keywords: snapshot.keywords.filter((kw: any) => kw.group_id === g.uid).map((kw: any) => ({ keywords: kw.keywords,
          negative_keywords: kw.negative_keywords ?? [], synonyms: kw.synonyms ?? [], max_repeats: kw.max_repeats,
          priority: kw.priority, comment: kw.comment ?? null, tag: kw.tag ?? null,
          bot_action: outAction(kw.bot_action), escalation_action: outAction(kw.escalation_action) })) })),
    } };
  }
  private async verifyEngines(patch: any, tenant: number) {
    for (const kind of ['stt', 'tts'] as const) {
      if (patch[`${kind}_engine_id`] != null) await this.providers.loadSpeechEngine(tenant, patch[`${kind}_engine_id`], kind);
    }
  }
  async preflight(args: Record<string, any>, tenant: number) {
    assertNoTenantAliases(args);
    assertNoSecretArgs(args);
    const noAuthHeaders = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.webhookAuth?.customHeaders?.some((h: any) => h.value)) throw new BadRequestException('SECRET_ARG_FORBIDDEN:webhookAuth.customHeaders');
      for (const value of Object.values(node)) noAuthHeaders(value);
    };
    noAuthHeaders(args);
    if (args.file) requireScenario(args.file);
    if (args.scenario) requireScenario(args.scenario);
    if (args.data) await this.verifyEngines(args.data, tenant);
  }
  /** Expected revision is server-authored in base proposals; standalone writes lock and validate the current graph. */
  async write(operation: string, args: Record<string, any>, tenant: number, expectedRevision?: string): Promise<Record<string, any>> {
    await this.preflight(args, tenant);
    const parent = await this.parentId(operation, args, tenant);
    const result = await this.robots.sequelize!.transaction(async transaction => {
      let robot = parent == null ? null : await this.ownedRobot(tenant, parent, transaction, true);
      const before = robot ? await this.snapshot(tenant, robot.uid, transaction) : null;
      if (expectedRevision && expectedRevision !== (before ? robotRevision(before) : 'new')) throw new ConflictException('ROBOT_STATE_CHANGED: read configuration again');
      const patch = args.data ? { ...args.data } : {};
      let row: any; let imported: Record<string, any> | undefined;
      if (operation === 'create_voice_robot') {
        robot = await this.robots.create({ ...patch, active: patch.active === undefined ? 0 : Number(patch.active), user_uid: tenant }, { transaction }); row = robot;
        if (args.scenario) imported = await this.importInTransaction(requireScenario(args.scenario), robot!, tenant, transaction);
      } else if (operation === 'update_voice_robot') { await robot!.update(patch, { transaction }); row = robot;
      } else if (operation === 'delete_voice_robot') {
        await this.references.assertNotReferenced('voicerobot', robot!.uid, tenant, 'Robot is referenced and cannot be deleted');
        await robot!.destroy({ transaction }); return { deleted: true, uid: parent };
      } else if (operation === 'import_voice_robot_scenario') {
        imported = await this.importInTransaction(requireScenario(args.file), robot!, tenant, transaction); row = robot;
      } else if (operation.includes('keyword_group')) {
        const model = this.groups;
        if (operation.startsWith('create')) row = await model.create({ ...patch, active: Number(patch.active), is_global: Number(patch.is_global), robot_id: parent, user_uid: tenant }, { transaction });
        else {
          row = await model.findOne({ where: { uid: args.uid, robot_id: parent, user_uid: tenant }, transaction });
          if (!row) throw new NotFoundException('Group not found');
          if (operation.startsWith('delete')) await row.destroy({ transaction }); else await row.update(patch, { transaction });
        }
      } else if (operation.includes('keyword')) {
        if (operation.startsWith('create')) row = await this.keywords.create({ ...patch, group_id: args.groupId, user_uid: tenant }, { transaction });
        else {
          row = await this.keywords.findOne({ where: { uid: args.uid, user_uid: tenant }, transaction });
          if (!row) throw new NotFoundException('Keyword not found');
          if (operation.startsWith('delete')) await row.destroy({ transaction }); else await row.update(patch, { transaction });
        }
      } else if (operation.includes('data_list')) {
        if (operation.startsWith('create')) row = await this.lists.create({ ...patch, robot_id: parent, user_uid: tenant }, { transaction });
        else {
          row = await this.lists.findOne({ where: { uid: args.uid, robot_id: parent, user_uid: tenant }, transaction });
          if (!row) throw new NotFoundException('Data list not found');
          if (operation.startsWith('delete')) await row.destroy({ transaction }); else await row.update(patch, { transaction });
        }
      } else throw new BadRequestException('Unknown robot write');
      const after = await this.snapshot(tenant, robot!.uid, transaction);
      for (const list of after.dataLists) {
        const keys = new Set(list.columns.map((c: any) => c.key));
        if (keys.size !== list.columns.length || !list.columns.some((c: any) => c.searchable)
          || list.rows.some((row: any) => Object.keys(row).some(key => !keys.has(key)))) throw new BadRequestException('Invalid data-list columns/rows');
      }
      // Reject dangling/cross-robot IDs atomically after applying a candidate mutation.
      if (after.groups.length) requireScenario(this.toPortable(after));
      else if (after.robot.initial_group_id || [after.robot.fallback_bot_action, after.robot.max_retries_bot_action].some(a => a?.nextState?.type === 'switch_group' || a?.nextState?.type === 'search_data_list')) throw new ConflictException('Robot references an absent group/list');
      return { uid: row?.uid ?? robot!.uid, robotId: robot!.uid, ...(operation.startsWith('delete') ? { deleted: true } : {}),
        ...(imported ? { imported } : {}), revision: robotRevision(after) };
    });
    if (operation.includes('data_list') && args.uid) this.search.clearListCache(args.uid);
    return result;
  }
  private async importInTransaction(file: ScenarioFile, robot: VoiceRobot, tenant: number, transaction: Transaction) {
    const listMap = new Map<string, number>(); const groupMap = new Map<string, number>(); let keywords = 0;
    for (const list of file.scenario.dataLists) {
      const { key, ...data } = list; const row = await this.lists.create({ ...data, robot_id: robot.uid, user_uid: tenant }, { transaction }); listMap.set(key, row.uid);
    }
    for (const group of file.scenario.groups) {
      const { key, keywords: _keywords, ...data } = group;
      const row = await this.groups.create({ ...data, active: Number(data.active), is_global: Number(data.is_global), robot_id: robot.uid, user_uid: tenant }, { transaction }); groupMap.set(key, row.uid);
    }
    for (const group of file.scenario.groups) for (const kw of group.keywords) {
      await this.keywords.create({ ...kw, group_id: groupMap.get(group.key), user_uid: tenant,
        bot_action: mapPortableAction(kw.bot_action, groupMap, listMap), escalation_action: mapPortableAction(kw.escalation_action, groupMap, listMap) }, { transaction }); keywords++;
    }
    await robot.update({ greeting_tts_text: file.scenario.greetingTtsText,
      initial_group_id: file.scenario.initialGroupKey ? groupMap.get(file.scenario.initialGroupKey) : null,
      fallback_bot_action: mapPortableAction(file.scenario.fallbackBotAction, groupMap, listMap),
      max_retries_bot_action: mapPortableAction(file.scenario.maxRetriesBotAction, groupMap, listMap) }, { transaction });
    return { groups: groupMap.size, keywords, dataLists: listMap.size,
      groupIds: Object.fromEntries(groupMap), listIds: Object.fromEntries(listMap), mode: 'append' };
  }
}
