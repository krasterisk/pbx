import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IvrsService } from './ivrs.service';
import { ContextsService } from '../contexts/contexts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { QueuesService } from '../queues/queues.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';

export type VoiceMenuDestKind = 'context' | 'extension' | 'queue' | 'menu';

export interface DigitDestination {
  kind: VoiceMenuDestKind;
  target: string;
}

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
- Меню = карта цифр. Каждая цифра ведёт в контекст, абонента, очередь или другое меню.
- t — таймаут, i — неверный ввод. Меню обычно достигается с входящего маршрута — прочитай маршруты до правки.`;
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
    return {
      name: 'create_ivr',
      description: 'Предлагает создать голосовое меню. Каждая цифра должна указывать на существующее назначение тенанта.',
      inputSchema: {
        name: { type: 'string', description: 'Имя меню' },
        description: { type: 'string' },
        menu_items: { type: 'array', description: '[{digit, actions}] карта цифр' },
        steps: { type: 'array', description: 'Псевдоним menu_items' },
      },
      entityType: 'ivr',
      proposes: true,
      handler: async (args, uid) => {
        const menuItems = asMenuItems(args.menu_items ?? args.steps);
        const refused = await this.refuseMissingDestinations(menuItems, uid);
        if (refused) return refused;

        const applyArgs: Record<string, unknown> = {
          name: String(args.name ?? ''),
          menu_items: menuItems,
        };
        if (args.description) applyArgs.description = args.description;

        return this.proposal(
          'create_ivr',
          String(args.name || 'IVR'),
          applyArgs,
          null,
          { name: applyArgs.name, digits: digitMapOf(menuItems) },
          [`Создать голосовое меню ${applyArgs.name}`],
        );
      },
    };
  }

  private toolUpdateIvr(): AiToolDefinition {
    return {
      name: 'update_ivr',
      description:
        'Предлагает изменить голосовое меню. Смена цифры — изменение маршрутизации, не безопасная правка. Назначение должно существовать у тенанта.',
      inputSchema: {
        id: { type: 'number', description: 'UID меню из list_ivrs / get_pbx_state' },
        name: { type: 'string' },
        description: { type: 'string' },
        digit: { type: 'string', description: 'Одна цифра для замены назначения' },
        destination: { type: 'object', description: '{kind: context|extension|queue|menu, target}' },
        menu_items: { type: 'array' },
        steps: { type: 'array' },
      },
      entityType: 'ivr',
      proposes: true,
      handler: async (args, uid) => {
        const id = Number(args.id);
        const current = await this.ivrsService.findOne(id, uid);
        const currentItems = asMenuItems(current.menu_items);
        const nextItems = this.nextMenuItems(currentItems, args);
        const refused = await this.refuseMissingDestinations(nextItems, uid);
        if (refused) return refused;

        const applyArgs: Record<string, unknown> = { id, menu_items: nextItems };
        if (args.name) applyArgs.name = args.name;
        if (args.description) applyArgs.description = args.description;

        const digit = args.digit != null ? String(args.digit) : changedDigit(currentItems, nextItems);
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
          applyArgs,
          digit ? { digit, target: oldDest?.target ?? null, kind: oldDest?.kind ?? null } : { digits: digitMapOf(currentItems) },
          digit ? { digit, target: newDest?.target ?? null, kind: newDest?.kind ?? null } : { digits: digitMapOf(nextItems) },
          summary,
        );
      },
    };
  }

  private toolDeleteIvr(): AiToolDefinition {
    return {
      name: 'delete_ivr',
      description: 'Предлагает удалить голосовое меню по UID. Деструктивно, только внутри тенанта.',
      inputSchema: {
        id: { type: 'number', description: 'UID меню' },
      },
      entityType: 'ivr',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const id = Number(args.id);
        const current = await this.ivrsService.findOne(id, uid);
        return this.proposal(
          'delete_ivr',
          String(current.name || id),
          { id },
          { uid: current.uid, name: current.name, digits: digitMapOf(current.menu_items) },
          null,
          [`Удалить голосовое меню ${current.name || id}`],
        );
      },
    };
  }

  private nextMenuItems(current: MenuItem[], args: Record<string, unknown>): MenuItem[] {
    if (args.menu_items != null || args.steps != null) {
      return asMenuItems(args.menu_items ?? args.steps);
    }
    if (args.digit != null && args.destination) {
      const digit = String(args.digit);
      const dest = asDestination(args.destination);
      const action = actionFromDestination(dest);
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

  private async refuseMissingDestinations(
    items: MenuItem[],
    uid: number,
  ): Promise<Record<string, unknown> | null> {
    const catalog = await this.loadCatalog(uid);
    for (const item of items) {
      const dest = destinationFromActions(item.actions);
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

  private async loadCatalog(uid: number): Promise<DestCatalog> {
    const [menus, contexts, endpoints, queues] = await Promise.all([
      this.ivrsService.findAll(uid),
      this.contextsService.findAll(uid),
      this.endpointsService.findAll(uid),
      this.queuesService.findAll(uid),
    ]);
    return { menus, contexts, endpoints, queues };
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

interface MenuItem {
  digit: string;
  actions: Array<Record<string, unknown>>;
}

interface DestCatalog {
  menus: Array<{ uid?: number; name?: string }>;
  contexts: Array<{ uid?: number; name?: string }>;
  endpoints: Array<{ extension?: string; sipUsername?: string }>;
  queues: Array<{ name?: string; exten?: string }>;
}

function asMenuItems(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const actions = Array.isArray(rec.actions) ? rec.actions.filter((row) => row && typeof row === 'object') : [];
    return { digit: String(rec.digit ?? ''), actions: actions as Array<Record<string, unknown>> };
  });
}

function asDestination(value: unknown): DigitDestination {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    kind: String(rec.kind || 'queue') as VoiceMenuDestKind,
    target: String(rec.target ?? ''),
  };
}

function digitMapOf(items: unknown): Record<string, DigitDestination | { kind: 'none' }> {
  const map: Record<string, DigitDestination | { kind: 'none' }> = {};
  for (const item of asMenuItems(items)) {
    const dest = destinationFromActions(item.actions);
    map[item.digit] = dest ?? { kind: 'none' };
  }
  return map;
}

function destinationOfDigit(items: MenuItem[], digit: string): DigitDestination | null {
  const item = items.find((row) => String(row.digit) === digit);
  return item ? destinationFromActions(item.actions) : null;
}

function destinationFromActions(actions: unknown): DigitDestination | null {
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    const rec = action as Record<string, unknown>;
    const type = String(rec.type || '');
    const params = (rec.params && typeof rec.params === 'object' ? rec.params : {}) as Record<string, unknown>;
    if (type === 'toqueue') {
      return { kind: 'queue', target: String(targetValue(params) ?? '') };
    }
    if (type === 'toivr') {
      return { kind: 'menu', target: String(params.ivr_uid ?? '') };
    }
    if (type === 'dial' || type === 'toendpoint') {
      return { kind: 'extension', target: String(targetValue(params) ?? params.extension ?? '') };
    }
    if (type === 'goto' || type === 'tocontext') {
      return { kind: 'context', target: String(params.context ?? params.context_name ?? targetValue(params) ?? '') };
    }
  }
  return null;
}

function targetValue(params: Record<string, unknown>): unknown {
  const target = params.target;
  if (typeof target === 'string' || typeof target === 'number') return target;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const rec = target as Record<string, unknown>;
    if (rec.value != null) return rec.value;
  }
  return params.queue ?? params.group;
}

function actionFromDestination(dest: DigitDestination): Record<string, unknown> {
  if (dest.kind === 'queue') {
    return { type: 'toqueue', params: { target: { source: 'fixed', value: dest.target } } };
  }
  if (dest.kind === 'menu') {
    return { type: 'toivr', params: { ivr_uid: Number(dest.target) || dest.target } };
  }
  if (dest.kind === 'extension') {
    return { type: 'dial', params: { target: { source: 'fixed', value: dest.target } } };
  }
  return { type: 'goto', params: { context: dest.target } };
}

function catalogResolves(catalog: DestCatalog, dest: DigitDestination): boolean {
  const target = dest.target;
  if (!target) return false;
  if (dest.kind === 'queue') {
    return catalog.queues.some((queue) =>
      queue.name === target || String(queue.exten) === target,
    );
  }
  if (dest.kind === 'extension') {
    return catalog.endpoints.some((row) =>
      String(row.extension) === target || String(row.sipUsername) === target,
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
  return false;
}

function changedDigit(before: MenuItem[], after: MenuItem[]): string | null {
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
  return dest.target;
}
