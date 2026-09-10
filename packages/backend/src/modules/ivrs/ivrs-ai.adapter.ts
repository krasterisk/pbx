import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { z } from 'zod';
import { toPublicExten } from '../../shared/utils/tenant-public-id.util';
import { IvrsService } from './ivrs.service';
import { ContextsService } from '../contexts/contexts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { QueuesService } from '../queues/queues.service';
import { CallGroupsService } from '../call-groups/call-groups.service';
import { TtsEnginesService } from '../tts-engines/tts-engines.service';
import { isSpeechEngineConfigured, toSpeechEngineView } from '../tts-engines/tts-engines-ai.adapter';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';
import {
  actionFromIvrDestination,
  asIvrDestination,
  asIvrMenuItems,
  destinationFromIvrActions,
  normalizeIvrMenuItems,
  summarizeIvrMenu,
  type DigitDestination,
  type IvrMenuItem,
  type VoiceMenuDestKind,
} from './ivr-menu-actions.util';

import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

export type { DigitDestination, VoiceMenuDestKind };

const SCHEMA_VERSION = 'ivrs-1';

/** Dialplan action params are deliberately open; tenant aliases are rejected recursively at parse. */
const actionSchema = z.record(z.string(), z.unknown());

const destinationSchema = z.strictObject({
  kind: z.enum(['context', 'extension', 'queue', 'menu', 'group']),
  target: z.union([z.string(), z.number()]),
});

const menuItemInput = z.strictObject({
  digit: z.union([z.string(), z.number()]),
  actions: z.array(actionSchema).optional(),
  destination: destinationSchema.optional(),
});

const promptInput = z.strictObject({
  kind: z.string().optional(),
  text: z.string().optional(),
  engine_uid: z.number().int().min(0).optional(),
});

const menuItemArgs = z.strictObject({
  digit: z.string(),
  actions: z.array(actionSchema),
});

const promptArgs = z.strictObject({
  kind: z.string(),
  text: z.string().optional(),
  engine_uid: z.number().int().min(0),
});

const createInput = z.strictObject({
  name: z.string().min(1).describe('Имя меню'),
  prompts: z.array(promptInput).optional().describe('Приветствие [{kind: tts, text, engine_uid}]'),
  text: z.string().optional().describe('Текст TTS-приветствия, если prompts не переданы'),
  engine_uid: z.number().int().min(0).optional().describe('Не передавай: сервер сам выберет движок по имени'),
  engine: z.string().optional().describe('Имя TTS-движка из list_tts_engines, не uid'),
  menu_items: z
    .array(menuItemInput)
    .optional()
    .describe('[{digit, actions|destination}] цепочка пункта как в редакторе маршрутов; destination = первый шаг; t часто togroup затем totrunk/hangup'),
  steps: z.array(menuItemInput).optional().describe('Псевдоним menu_items'),
});

const createArgs = z.strictObject({
  name: z.string().min(1),
  menu_items: z.array(menuItemArgs),
  prompts: z.array(promptArgs).optional(),
});

const updateInput = z.strictObject({
  id: z.number().int().positive().describe('UID меню из list_ivrs / get_pbx_state'),
  name: z.string().optional(),
  description: z.string().optional(),
  digit: z.union([z.string(), z.number()]).optional().describe('Одна цифра для замены назначения'),
  destination: destinationSchema
    .optional()
    .describe('{kind: context|extension|queue|menu|group, target}'),
  prompts: z.array(promptInput).optional(),
  text: z.string().optional(),
  engine_uid: z.number().int().min(0).optional(),
  menu_items: z.array(menuItemInput).optional(),
  steps: z.array(menuItemInput).optional(),
});

const updateArgs = z.strictObject({
  id: z.number().int().positive(),
  menu_items: z.array(menuItemArgs),
  name: z.string().optional(),
  prompts: z.array(promptArgs).optional(),
});

const byId = z.strictObject({ id: z.number().int().positive().describe('UID меню') });

type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type UpdateInput = z.infer<typeof updateInput>;
type UpdateArgs = z.infer<typeof updateArgs>;
type ById = z.infer<typeof byId>;

/**
 * IvrsAiAdapter — voice-menu mutations as proposals (D-18, D-27).
 * Update is always proposal-gated: a digit change rewrites inbound routing.
 */
@Injectable()
export class IvrsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(IvrsAiAdapter.name);
  readonly domain = 'ivrs';

  constructor(
    private readonly ivrsService: IvrsService,
    private readonly registry: AiAdapterRegistryService,
    private readonly contextsService: ContextsService,
    private readonly endpointsService: EndpointsService,
    private readonly queuesService: QueuesService,
    private readonly callGroupsService: CallGroupsService,
    @Optional() private readonly ttsEngines?: TtsEnginesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('IvrsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListIvrs(), this.toolCreateIvr(), this.toolUpdateIvr(), this.toolDeleteIvr()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Голосовые меню (IVR)
- Цифра — цепочка действий того же редактора, что у маршрутов (DialplanAppsEditor). destination {kind,target} = только первый шаг. Абонент — kind extension (toexten). Таймаут t обычно начинается с kind group (togroup).
- После группы внешний номер / почта / сброс — следующие actions (totrunk, voicemail, hangup), не overflow группы и не «замени группу очередью». Перед нетривиальной цепочкой — list_dialplan_apps(host=ivr).
- «группа 101-103» = одна группа с членами 101–103. Приветствие — prompts TTS, не description. Текст и карту цифр из любой реплики треда не переспрашивай.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const menus = await this.ivrsService.findAll(vpbxUserUid);
    if (menus.length === 0) return '';
    const names = menus.map((menu) => menu.name || `#${menu.uid}`).join(', ');
    return `Голосовые меню: ${names}`;
  }

  private toolListIvrs(): AiToolDefinition {
    return {
      name: 'list_ivrs',
      description: 'Список голосовых меню тенанта с картой цифр и назначениями. Без изменений.',
      inputSchema: {},
      entityType: 'ivr',
      handler: async (_args, uid) => {
        const rows = await this.ivrsService.findAll(uid);
        return {
          menus: rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            timeout: row.timeout,
            digits: digitMapOf(row.menu_items),
          })),
        };
      },
    };
  }

  private toolCreateIvr(): AiToolDefinition {
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_ivr',
      description: 'Предлагает создать голосовое меню. Каждая цифра должна указывать на существующее назначение тенанта.',
      entityType: 'ivr',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const uid = ctx.vpbxUserUid;
        const catalog = this.mergePlanned(await this.loadCatalog(uid), ctx.planned);
        const normalized = this.normalizeProposedMenu(
          input.menu_items ?? input.steps,
          catalog,
          uid,
          'create_ivr',
        );
        if (normalized.refused) return normalized.refused;
        const menuItems = normalized.items;

        const prompts = await this.resolvePrompts(input as Record<string, unknown>, uid);
        const applyArgs: CreateArgs = {
          name: input.name,
          menu_items: menuItems as CreateArgs['menu_items'],
        };
        if (prompts.length) applyArgs.prompts = toApplyPrompts(prompts);

        const summary = summarizeCreateIvr(
          applyArgs.name,
          prompts,
          menuItems,
          catalog,
        );

        return this.proposal(
          'create_ivr',
          `Меню «${input.name || 'IVR'}»`,
          applyArgs as unknown as Record<string, unknown>,
          null,
          {
            name: applyArgs.name,
            digits: publicDigitMapOf(menuItems, catalog),
            greeting: prompts[0]?.text ?? null,
            voice: prompts[0]?.engineName ?? null,
          },
          summary,
        );
      },
      revalidate: (args, ctx) => this.revalidateMenu(args, args.menu_items, ctx, 'create_ivr'),
      apply: async (args, ctx) => {
        await this.ivrsService.create(args as never, ctx.vpbxUserUid, ctx.isAdmin);
      },
    });
  }

  private toolUpdateIvr(): AiToolDefinition {
    return defineMutationTool<UpdateInput, UpdateArgs>({
      name: 'update_ivr',
      description:
        'Предлагает изменить голосовое меню. Смена цифры — изменение маршрутизации, не безопасная правка. Назначение должно существовать у тенанта.',
      entityType: 'ivr',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const uid = ctx.vpbxUserUid;
        const id = input.id;
        const current = await this.ivrsService.findOne(id, uid);
        const catalog = this.mergePlanned(await this.loadCatalog(uid), ctx.planned);
        const currentItems = asIvrMenuItems(current.menu_items);
        const normalized = this.normalizeProposedMenu(
          this.nextMenuItems(currentItems, input as Record<string, unknown>),
          catalog,
          uid,
          'update_ivr',
        );
        if (normalized.refused) return normalized.refused;
        const nextItems = normalized.items;

        const applyArgs: UpdateArgs = { id, menu_items: nextItems as UpdateArgs['menu_items'] };
        if (input.name) applyArgs.name = input.name;
        const prompts = await this.resolvePrompts(input as Record<string, unknown>, uid);
        if (prompts.length) applyArgs.prompts = toApplyPrompts(prompts);

        const digit = input.digit != null ? String(input.digit) : changedDigit(currentItems, nextItems);
        const oldDest = digit ? destinationOfDigit(currentItems, digit) : null;
        const newDest = digit ? destinationOfDigit(nextItems, digit) : null;
        const summary = digit
          ? [
              `Цифра ${digit}: ${formatDest(oldDest)} → ${formatDest(newDest)}`,
            ]
          : [`Изменить голосовое меню ${current.name || id}`];

        return this.proposal(
          'update_ivr',
          String(current.name || id),
          applyArgs as unknown as Record<string, unknown>,
          digit ? { digit, target: oldDest?.target ?? null, kind: oldDest?.kind ?? null } : { digits: digitMapOf(currentItems) },
          digit ? { digit, target: newDest?.target ?? null, kind: newDest?.kind ?? null } : { digits: digitMapOf(nextItems) },
          summary,
        );
      },
      revalidate: async (args, ctx) => {
        const owned = await this.requireIvr(args, args.id, ctx);
        if (!owned.ok) return owned;
        return this.revalidateMenu(args, args.menu_items, ctx, 'update_ivr');
      },
      apply: async (args, ctx) => {
        const { id, ...rest } = args;
        await this.ivrsService.update(id, rest as never, ctx.vpbxUserUid, ctx.isAdmin);
      },
    });
  }

  private toolDeleteIvr(): AiToolDefinition {
    return defineMutationTool<ById, ById>({
      name: 'delete_ivr',
      description: 'Предлагает удалить голосовое меню по UID. Деструктивно, только внутри тенанта.',
      entityType: 'ivr',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: byId,
      args: byId,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.ivrsService.findOne(input.id, ctx.vpbxUserUid);
        return this.proposal(
          'delete_ivr',
          String(current.name || input.id),
          { id: input.id },
          { uid: current.uid, name: current.name, digits: digitMapOf(current.menu_items) },
          null,
          [`Удалить голосовое меню ${current.name || input.id}`],
        );
      },
      revalidate: (args, ctx) => this.requireIvr(args, args.id, ctx),
      apply: async (args, ctx) => {
        await this.ivrsService.remove(args.id, ctx.vpbxUserUid);
      },
    });
  }

  private async requireIvr<T>(
    args: T,
    id: number,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    try {
      await this.ivrsService.findOne(id, ctx.vpbxUserUid);
      return { ok: true, args };
    } catch {
      return { ok: false, reason: `Голосовое меню ${id} не найдено у тенанта` };
    }
  }

  /**
   * Confirm-time healing: the canonical menu is re-resolved against the catalog as
   * it is now, so a destination deleted between proposal and confirmation stops the
   * write instead of persisting a dead digit.
   */
  private async revalidateMenu<T extends { menu_items: unknown }>(
    args: T,
    menuItems: unknown,
    ctx: AiMutationContext,
    tool: string,
  ): Promise<MutationRevalidation<T>> {
    const catalog = await this.loadCatalog(ctx.vpbxUserUid);
    const normalized = this.normalizeProposedMenu(menuItems, catalog, ctx.vpbxUserUid, tool);
    if (normalized.refused) {
      return { ok: false, reason: String(normalized.refused.message) };
    }
    return { ok: true, args: { ...args, menu_items: normalized.items } };
  }

  private nextMenuItems(current: IvrMenuItem[], args: Record<string, unknown>): IvrMenuItem[] {
    if (args.menu_items != null || args.steps != null) {
      return asIvrMenuItems(args.menu_items ?? args.steps);
    }
    if (args.digit != null && args.destination) {
      const digit = String(args.digit);
      const dest = asIvrDestination(args.destination);
      const action = actionFromIvrDestination(dest, { digit });
      const replaced = current.map((item) =>
        String(item.digit) === digit ? { digit, actions: [action] } : item,
      );
      if (!replaced.some((item) => String(item.digit) === digit)) {
        replaced.push({ digit, actions: [action] });
      }
      return replaced;
    }
    return current;
  }

  private normalizeProposedMenu(
    raw: unknown,
    catalog: DestCatalog,
    uid: number,
    tool: string,
  ): { items: IvrMenuItem[]; refused?: AiToolRefusal } {
    const resolved = resolveMenuItems(asIvrMenuItems(raw), catalog);
    const normalized = normalizeIvrMenuItems(resolved, uid);
    if (normalized.aliases.length) {
      this.logger.warn(
        `${tool} tenant=${uid} rewritten action types: ${JSON.stringify(normalized.aliases)}`,
      );
    }
    if (normalized.unmapped.length) {
      this.logger.warn(
        `${tool} tenant=${uid} refused unknown action types: ${JSON.stringify(normalized.unmapped)}`,
      );
      return {
        items: normalized.items,
        refused: {
          refused: true,
          message: `Неизвестный тип действия диалплана: ${normalized.unmapped.map((row) => row.type).join(', ')}. Нужны типы редактора маршрутов: toexten, togroup, toqueue, toivr, toroute, totrunk, voicemail, hangup, playback.`,
        },
      };
    }
    const refused = refuseMissingDestinations(normalized.items, catalog);
    if (refused) return { items: normalized.items, refused };
    this.logger.log(`${tool} tenant=${uid} menu=${summarizeIvrMenu(normalized.items)}`);
    return { items: normalized.items };
  }

  private async resolvePrompts(args: Record<string, unknown>, uid: number): Promise<PromptPhrase[]> {
    const prompts = asPrompts(args);
    if (!prompts.length) return prompts;
    const picked = await this.pickTtsEngine(uid, args);
    return prompts.map((prompt) => {
      if (Number(prompt.engine_uid) > 0 && !args.engine) {
        return { ...prompt, engineName: picked?.name };
      }
      if (!picked) return prompt;
      return { ...prompt, engine_uid: picked.uid, engineName: picked.name };
    });
  }

  private async pickTtsEngine(
    uid: number,
    args: Record<string, unknown>,
  ): Promise<{ uid: number; name: string } | null> {
    if (!this.ttsEngines) return null;
    const rows = await this.ttsEngines.findAll(uid);
    const views = rows
      .map((row) => ({ row, view: toSpeechEngineView(row) }))
      .filter((item) => item.view.enabled && isSpeechEngineConfigured(item.row));
    const named = typeof args.engine === 'string' ? args.engine.trim().toLowerCase() : '';
    if (named) {
      const hit = views.find((item) => item.view.name.trim().toLowerCase() === named)
        ?? rows.find((row) => String(row.name ?? '').trim().toLowerCase() === named);
      if (hit && 'view' in hit) return { uid: Number(hit.row.uid), name: hit.view.name };
      if (hit && 'uid' in hit) return { uid: Number(hit.uid), name: String(hit.name ?? '') };
    }
    const requested = Number(args.engine_uid);
    if (requested > 0) {
      const hit = views.find((item) => Number(item.row.uid) === requested);
      if (hit) return { uid: requested, name: hit.view.name };
    }
    if (views.length === 0) return null;
    const yandex = views.find((item) =>
      /yandex/i.test(item.view.name) || /yandex/i.test(String(item.view.vendor ?? '')),
    );
    const chosen = yandex ?? views[0];
    return { uid: Number(chosen.row.uid), name: chosen.view.name };
  }

  private mergePlanned(catalog: DestCatalog, planned?: AiMutationContext['planned']): DestCatalog {
    if (!planned) return catalog;
    return {
      ...catalog,
      endpoints: [
        ...catalog.endpoints,
        ...planned.extensions.map((extension) => ({ extension })),
      ],
      groups: [
        ...catalog.groups,
        ...planned.groups.map((group) => ({ name: group.name, exten: group.exten })),
      ],
      queues: [
        ...catalog.queues,
        ...planned.queues.map((queue) => ({ name: queue.name, exten: queue.exten })),
      ],
    };
  }

  private async loadCatalog(uid: number): Promise<DestCatalog> {
    const [menus, contexts, endpoints, queues, groups] = await Promise.all([
      this.ivrsService.findAll(uid),
      this.contextsService.findAll(uid),
      this.endpointsService.findAll(uid),
      this.queuesService.findAll(uid),
      this.callGroupsService.findAll(uid),
    ]);
    return { menus, contexts, endpoints, queues, groups };
  }

  private proposal(
    tool: string,
    label: string,
    args: Record<string, unknown>,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    summary: string[],
  ): AgentDiffProposal {
    return {
      entityType: 'ivr',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}

interface DestCatalog {
  menus: Array<{ uid?: number; name?: string }>;
  contexts: Array<{ uid?: number; name?: string }>;
  endpoints: Array<{ extension?: string; sipUsername?: string }>;
  queues: Array<{ name?: string; exten?: string }>;
  groups: Array<{ uid?: number; name?: string; exten?: string }>;
}

interface PromptPhrase {
  kind: string;
  text?: string;
  engine_uid?: number;
  engineName?: string;
}

function asPrompts(args: Record<string, unknown>): PromptPhrase[] {
  if (Array.isArray(args.prompts)) {
    return args.prompts
      .filter((row) => row && typeof row === 'object')
      .map((row) => {
        const rec = row as Record<string, unknown>;
        return {
          kind: String(rec.kind || 'tts'),
          text: rec.text != null ? String(rec.text) : undefined,
          engine_uid: rec.engine_uid != null ? Number(rec.engine_uid) : 0,
        };
      });
  }
  const text = args.text != null ? String(args.text).trim() : '';
  if (!text) return [];
  return [{ kind: 'tts', text, engine_uid: args.engine_uid != null ? Number(args.engine_uid) : 0 }];
}

function toApplyPrompts(prompts: PromptPhrase[]): Array<{ kind: string; text?: string; engine_uid: number }> {
  return prompts.map((prompt) => ({
    kind: prompt.kind,
    ...(prompt.text != null ? { text: prompt.text } : {}),
    engine_uid: Number(prompt.engine_uid ?? 0),
  }));
}

function resolveMenuItems(items: IvrMenuItem[], catalog: DestCatalog): IvrMenuItem[] {
  return items.map((item) => {
    const dest = destinationFromIvrActions(item.actions);
    if (!dest || dest.kind !== 'group') return item;
    const group = resolveGroup(catalog, dest.target);
    if (!group?.uid) return item;
    let replaced = false;
    const actions = item.actions.map((action, index) => {
      if (replaced || String(action.type ?? '') !== 'togroup') return action;
      replaced = true;
      return actionFromIvrDestination(
        { kind: 'group', target: String(group.uid) },
        { digit: item.digit, index },
      );
    });
    return { digit: item.digit, actions };
  });
}

function refuseMissingDestinations(
  items: IvrMenuItem[],
  catalog: DestCatalog,
): AiToolRefusal | null {
  for (const item of items) {
    const dest = destinationFromIvrActions(item.actions);
    if (!dest) continue;
    if (!catalogResolves(catalog, dest)) {
      return {
        refused: true,
        digit: String(item.digit),
        destination: dest.target,
        message: `Цифра ${item.digit} указывает на несуществующее назначение ${dest.target}`,
      };
    }
  }
  return null;
}

function resolveGroup(catalog: DestCatalog, target: string) {
  return catalog.groups.find((group) =>
    String(group.uid) === target
    || group.name === target
    || String(group.exten) === target,
  );
}

function digitMapOf(items: unknown): Record<string, DigitDestination | { kind: 'none' }> {
  const map: Record<string, DigitDestination | { kind: 'none' }> = {};
  for (const item of asIvrMenuItems(items)) {
    const dest = destinationFromIvrActions(item.actions);
    map[item.digit] = dest ?? { kind: 'none' };
  }
  return map;
}

function destinationOfDigit(items: IvrMenuItem[], digit: string): DigitDestination | null {
  const item = items.find((row) => String(row.digit) === digit);
  return item ? destinationFromIvrActions(item.actions) : null;
}

function catalogResolves(catalog: DestCatalog, dest: DigitDestination): boolean {
  const target = dest.target;
  if (!target) return false;
  if (dest.kind === 'queue') {
    const publicTarget = toPublicExten(target);
    return catalog.queues.some((queue) =>
      queue.name === target
      || String(queue.exten) === target
      || String(queue.exten) === publicTarget
      || toPublicExten(queue.name) === publicTarget,
    );
  }
  if (dest.kind === 'extension') {
    const publicTarget = toPublicExten(target);
    return catalog.endpoints.some((row) =>
      String(row.extension) === target
      || String(row.sipUsername) === target
      || String(row.extension) === publicTarget
      || toPublicExten(row.sipUsername) === publicTarget,
    );
  }
  if (dest.kind === 'menu') {
    return catalog.menus.some((menu) =>
      String(menu.uid) === target || menu.name === target,
    );
  }
  if (dest.kind === 'context') {
    return catalog.contexts.some((context) =>
      String(context.uid) === target || context.name === target,
    );
  }
  if (dest.kind === 'group') {
    return !!resolveGroup(catalog, target);
  }
  return false;
}

function changedDigit(before: IvrMenuItem[], after: IvrMenuItem[]): string | null {
  const beforeMap = new Map(before.map((item) => [String(item.digit), JSON.stringify(item.actions)]));
  for (const item of after) {
    if (beforeMap.get(String(item.digit)) !== JSON.stringify(item.actions)) {
      return String(item.digit);
    }
  }
  return null;
}

function formatDest(dest: DigitDestination | null): string {
  if (!dest) return 'нет';
  return formatIvrRoute(dest.kind, dest.target);
}

function kindLabel(kind: string): string {
  if (kind === 'extension') return 'абонент';
  if (kind === 'group') return 'группа';
  if (kind === 'queue') return 'очередь';
  if (kind === 'menu') return 'меню';
  if (kind === 'context') return 'контекст';
  return kind;
}

function formatIvrRoute(kind: string, target: string): string {
  return `${kindLabel(kind)} ${target}`.trim();
}

function digitLabel(digit: string): string {
  if (digit === 't') return 'таймаут';
  if (digit === 'i') return 'ошибка ввода';
  return digit;
}

function publicDest(dest: DigitDestination, catalog?: DestCatalog): DigitDestination {
  if (dest.kind === 'group' && catalog) {
    const group = resolveGroup(catalog, dest.target);
    return { kind: 'group', target: String(group?.exten || group?.name || dest.target) };
  }
  if (dest.kind === 'extension') {
    return { kind: 'extension', target: toPublicExten(dest.target) };
  }
  return dest;
}

function publicDigitMapOf(items: unknown, catalog: DestCatalog): Record<string, DigitDestination | { kind: 'none' }> {
  const map: Record<string, DigitDestination | { kind: 'none' }> = {};
  for (const item of asIvrMenuItems(items)) {
    const dest = destinationFromIvrActions(item.actions);
    map[item.digit] = dest ? publicDest(dest, catalog) : { kind: 'none' };
  }
  return map;
}

function summarizeCreateIvr(
  name: string,
  prompts: Array<{ text?: string; engine_uid?: number; engineName?: string }>,
  items: IvrMenuItem[],
  catalog?: DestCatalog,
): string[] {
  const lines = [`Создать голосовое меню ${name}`];
  const greeting = prompts[0]?.text?.trim();
  if (greeting) lines.push(`Приветствие: ${greeting}`);
  if (prompts[0]?.engineName) {
    lines.push(`Голос: ${prompts[0].engineName}`);
  } else if (prompts[0] && !Number(prompts[0].engine_uid)) {
    lines.push('Голосовой движок не настроен в кабинете — фразу можно повесить на экране меню.');
  }
  for (const item of items) {
    const dest = destinationFromIvrActions(item.actions);
    if (!dest) continue;
    const shown = publicDest(dest, catalog);
    lines.push(`${digitLabel(item.digit)} → ${formatIvrRoute(shown.kind, shown.target)}`);
  }
  return lines;
}
