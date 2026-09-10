import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { RoutesService } from './routes.service';
import { ContextsService } from '../contexts/contexts.service';
import { QueuesService } from '../queues/queues.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { DirectoriesService } from '../directories/directories.service';
import { CallGroupsService } from '../call-groups/call-groups.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
} from '../ai-platform/ai-mutation.contract';
import {
  validateRouteChainDraft,
  type TenantEntityRefs,
} from './route-chain-draft.util';
import {
  checkRoutePrecedence,
  isCatchAllPattern,
  isEmergencyPattern,
  isSpecificNumericPattern,
} from '../ai-chat/route-precedence.util';
import type { DialplanAction, DialplanHost } from '@krasterisk/shared';
import { countDialplanAppUsage, listDialplanAppCatalog } from './dialplan-app-catalog';

const SCHEMA_VERSION = 'routes-1';

/** Dialplan action params stay open; nested tenant aliases are rejected recursively at parse. */
const actionSchema = z.record(z.string(), z.unknown());

const createInput = z.strictObject({
  context_uid: z.number().int().positive().describe('UID контекста из list_contexts'),
  pattern: z.string().min(1).optional().describe('Один шаблон, например _2XX или 7495…'),
  extensions: z.array(z.string().min(1)).optional().describe('Список шаблонов (альтернатива pattern)'),
  name: z.string().optional().describe('Имя маршрута'),
  actions: z.array(actionSchema).min(1).describe('Типизированная цепочка [{type, params, condition}]'),
});

const createArgs = z.strictObject({
  context_uid: z.number().int().positive(),
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
  actions: z.array(actionSchema).min(1),
});

const deleteInput = z.strictObject({
  id: z.number().int().positive().describe('UID маршрута из list_routes'),
});

const deleteArgs = z.strictObject({
  id: z.number().int().positive(),
  context_uid: z.number().int().positive(),
});

type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type DeleteInput = z.infer<typeof deleteInput>;
type DeleteArgs = z.infer<typeof deleteArgs>;

/**
 * RoutesAiAdapter — typed action-chain proposals (D-15, D-18, D-20).
 * Confirmation reloads the dialplan through the adapter-owned reload policy;
 * there is no standalone apply_dialplan tool.
 */
@Injectable()
export class RoutesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(RoutesAiAdapter.name);
  readonly domain = 'routes';

  constructor(
    private readonly routesService: RoutesService,
    private readonly contextsService: ContextsService,
    private readonly queuesService: QueuesService,
    private readonly endpointsService: EndpointsService,
    private readonly trunksService: TrunksService,
    private readonly ivrsService: IvrsService,
    private readonly directoriesService: DirectoriesService,
    private readonly callGroupsService: CallGroupsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('RoutesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListRoutes(),
      this.toolListDialplanApps(),
      this.toolDescribeChain(),
      this.toolCreateRoute(),
      this.toolDeleteRoute(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Маршруты
- Маршрут = шаблон в контексте + типизированная цепочка действий, не сырое имя приложения Asterisk.
- Пункты IVR — тот же редактор. Перед цепочкой вызови list_dialplan_apps (host=ivr|route): там типы, зачем шаг и что уже есть у тенанта. Не выдумывай приложения Asterisk.
- Сначала list_routes / describe_route_chain / list_contexts, затем proposal. Применение диалплана — шаг подтверждения, не отдельный инструмент.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const routes = await this.routesService.findAll(vpbxUserUid);
    if (routes.length === 0) return '';
    const labels = routes
      .slice(0, 8)
      .map((route) => `${route.name || `#${route.uid}`} [${(route.extensions ?? []).join(',')}]`);
    return `Маршруты: ${labels.join('; ')}`;
  }

  private toolListRoutes(): AiToolDefinition {
    return {
      name: 'list_routes',
      description: 'Список маршрутов тенанта: контекст, шаблоны и краткая цепочка. Без изменений.',
      inputSchema: {
        context_uid: { type: 'number', description: 'Опционально ограничить одним контекстом' },
      },
      entityType: 'route',
      handler: async (args, uid) => {
        const contextUid = args.context_uid != null ? Number(args.context_uid) : null;
        const rows = contextUid != null
          ? await this.routesService.findAllByContext(contextUid, uid)
          : await this.routesService.findAll(uid);
        return {
          routes: rows.map((row) => compactRoute(row)),
        };
      },
    };
  }

  private toolListDialplanApps(): AiToolDefinition {
    return {
      name: 'list_dialplan_apps',
      description:
        'Каталог приложений редактора маршрутов/IVR: тип, зачем, обязательные поля, сколько раз уже есть у тенанта. Не сырые приложения Asterisk.',
      inputSchema: {
        host: {
          type: 'string',
          enum: ['route', 'ivr', 'directory_policy'],
          description: 'Где собирается цепочка. ivr — пункт меню, route — маршрут.',
        },
        include_usage: {
          type: 'boolean',
          description: 'Счётчики usedIn.routes / usedIn.ivrs. По умолчанию true.',
        },
      },
      entityType: 'route',
      handler: async (args, uid) => {
        const host = parseDialplanHost(args.host);
        const includeUsage = args.include_usage !== false;
        const apps = listDialplanAppCatalog(host);
        const [routes, ivrs] = includeUsage
          ? await Promise.all([
              this.routesService.findAll(uid).catch(() => []),
              this.ivrsService.findAll(uid).catch(() => []),
            ])
          : [[], []];
        const usage = includeUsage ? countDialplanAppUsage(routes, ivrs) : {};
        return {
          host: host ?? 'all',
          apps: apps.map((app) => ({
            ...app,
            ...(includeUsage ? { usedIn: usage[app.type] ?? { routes: 0, ivrs: 0 } } : {}),
          })),
        };
      },
    };
  }

  private toolDescribeChain(): AiToolDefinition {
    return {
      name: 'describe_route_chain',
      description: 'Собранная цепочка действий всех маршрутов контекста по приоритету. Без изменений.',
      inputSchema: {
        context_uid: { type: 'number', description: 'UID контекста из list_contexts' },
      },
      entityType: 'route',
      handler: async (args, uid) => {
        const contextUid = Number(args.context_uid);
        const context = await this.findTenantContext(contextUid, uid);
        if (!context) {
          return this.refuseContext(contextUid);
        }
        const rows = await this.routesService.findAllByContext(contextUid, uid);
        return {
          context_uid: contextUid,
          context_name: context.name,
          routes: rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            extensions: row.extensions ?? [],
            priority: row.priority,
            actions: row.actions ?? [],
          })),
        };
      },
    };
  }

  private toolCreateRoute(): AiToolDefinition {
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_route',
      description:
        'Предлагает создать маршрут как типизированную цепочку действий. Не принимает сырое приложение Asterisk и аргументы.',
      entityType: 'route',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: {
        kind: 'dialplan-context',
        contextUid: (args: CreateArgs) => args.context_uid,
      },
      propose: async (input, ctx) => this.proposeCreate(input, ctx),
      revalidate: async (args, ctx) => this.revalidateCreate(args, ctx),
      apply: async (args, ctx) => {
        await this.routesService.create(
          {
            context_uid: args.context_uid,
            name: args.name,
            extensions: args.extensions,
            actions: args.actions,
          } as never,
          ctx.vpbxUserUid,
        );
      },
    });
  }

  private toolDeleteRoute(): AiToolDefinition {
    return defineMutationTool<DeleteInput, DeleteArgs>({
      name: 'delete_route',
      description: 'Предлагает удалить маршрут по UID. Деструктивно, только внутри тенанта.',
      entityType: 'route',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: deleteInput,
      args: deleteArgs,
      reload: {
        kind: 'dialplan-context',
        contextUid: (args: DeleteArgs) => args.context_uid,
      },
      propose: async (input, ctx) => {
        const current = await this.routesService.findOne(input.id, ctx.vpbxUserUid);
        const extensions = current.extensions ?? [];
        const destination = destinationOf(current.actions);
        const siblings = await this.routesService.findAllByContext(current.context_uid, ctx.vpbxUserUid);
        const remaining = siblings
          .filter((row) => row.uid !== current.uid)
          .slice()
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
          .flatMap((row) => row.extensions ?? []);
        const summary = [
          `Удалить маршрут ${extensions.join(', ') || input.id} → ${destination}; назначение перестанет работать`,
        ];
        const impact = impactNote(extensions, [...remaining, ...extensions]);
        if (impact) summary.push(impact);
        return this.proposal(
          'delete_route',
          String(current.name || extensions[0] || input.id),
          { id: input.id, context_uid: current.context_uid },
          {
            uid: current.uid,
            name: current.name,
            extensions,
            destination,
          },
          { patterns: remaining },
          summary,
        );
      },
      revalidate: async (args, ctx) => {
        try {
          await this.routesService.findOne(args.id, ctx.vpbxUserUid);
          return { ok: true, args };
        } catch {
          return { ok: false, reason: `Маршрут ${args.id} не найден у тенанта` };
        }
      },
      apply: async (args, ctx) => {
        await this.routesService.remove(args.id, ctx.vpbxUserUid);
      },
    });
  }

  private async proposeCreate(
    input: CreateInput,
    ctx: AiMutationContext,
  ): Promise<AgentDiffProposal | AiToolRefusal> {
    const context = await this.findTenantContext(input.context_uid, ctx.vpbxUserUid);
    if (!context) {
      return this.refuseContext(input.context_uid);
    }
    const extensions = this.readExtensions(input);
    if (!extensions.length) {
      return {
        refused: true,
        message: 'Нужен pattern или непустой extensions',
      };
    }
    const refs = await this.loadRefs(ctx.vpbxUserUid);
    const draft = validateRouteChainDraft(input.actions, refs);
    if (!draft.ok) {
      return {
        refused: true,
        stepIndex: draft.stepIndex,
        reason: draft.reason,
        message: `Шаг ${draft.stepIndex}: ${draft.reason}`,
      };
    }
    const existing = await this.routesService.findAllByContext(input.context_uid, ctx.vpbxUserUid);
    const resulting = [
      ...existing
        .slice()
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .flatMap((row) => row.extensions ?? []),
      ...extensions,
    ];
    const precedence = checkRoutePrecedence(resulting);
    if (!precedence.safe) {
      return {
        refused: true,
        catchAll: precedence.catchAll,
        shadowed: precedence.shadowed,
        message: `Порядок шаблонов небезопасен: catch-all ${precedence.catchAll} окажется выше ${precedence.shadowed}`,
      };
    }
    const name = String(input.name || extensions[0] || 'route');
    const applyArgs: CreateArgs = {
      context_uid: input.context_uid,
      name,
      extensions,
      actions: draft.chain as unknown as Record<string, unknown>[],
    };
    return this.proposal(
      'create_route',
      name,
      applyArgs,
      null,
      { context_uid: input.context_uid, pattern: extensions[0], patterns: resulting, actions: draft.chain },
      this.createSummary(extensions, draft.chain, resulting),
    );
  }

  private async revalidateCreate(args: CreateArgs, ctx: AiMutationContext) {
    const context = await this.findTenantContext(args.context_uid, ctx.vpbxUserUid);
    if (!context) {
      return { ok: false as const, reason: `Контекст ${args.context_uid} не принадлежит этому тенанту` };
    }
    const refs = await this.loadRefs(ctx.vpbxUserUid);
    const draft = validateRouteChainDraft(args.actions, refs);
    if (!draft.ok) {
      return { ok: false as const, reason: `Шаг ${draft.stepIndex}: ${draft.reason}` };
    }
    const existing = await this.routesService.findAllByContext(args.context_uid, ctx.vpbxUserUid);
    const resulting = [
      ...existing
        .slice()
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .flatMap((row) => row.extensions ?? []),
      ...args.extensions,
    ];
    const precedence = checkRoutePrecedence(resulting);
    if (!precedence.safe) {
      return {
        ok: false as const,
        reason: `Порядок шаблонов небезопасен: catch-all ${precedence.catchAll} окажется выше ${precedence.shadowed}`,
      };
    }
    return {
      ok: true as const,
      args: {
        ...args,
        actions: draft.chain as unknown as Record<string, unknown>[],
      },
    };
  }

  private createSummary(extensions: string[], chain: DialplanAction[], resulting: string[]): string[] {
    const steps = chain.map((action, index) => {
      const dest = destinationOf([action]);
      return `${index + 1}. ${action.type}${dest !== action.type ? ` → ${dest}` : ''}`;
    });
    const lines = [
      `Создать маршрут ${extensions.join(', ')}`,
      ...steps,
      'После подтверждения диалплан будет перезагружен',
    ];
    const impact = impactNote(extensions, resulting);
    if (impact) lines.push(impact);
    return lines;
  }

  private readExtensions(input: CreateInput): string[] {
    if (Array.isArray(input.extensions) && input.extensions.length > 0) {
      return input.extensions.map(String);
    }
    if (input.pattern != null && String(input.pattern)) {
      return [String(input.pattern)];
    }
    return [];
  }

  private async findTenantContext(
    contextUid: number,
    uid: number,
  ): Promise<{ uid: number; name: string } | null> {
    const contexts = await this.contextsService.findAll(uid);
    return contexts.find((row) => Number(row.uid) === contextUid) ?? null;
  }

  private refuseContext(contextUid: number): AiToolRefusal {
    return {
      refused: true,
      context_uid: contextUid,
      message: `Контекст ${contextUid} не принадлежит этому тенанту`,
    };
  }

  private async loadRefs(uid: number): Promise<TenantEntityRefs> {
    const [queues, endpoints, trunks, ivrs, routes, contexts, directories, groups] = await Promise.all([
      this.queuesService.findAll(uid),
      this.endpointsService.findAll(uid),
      this.trunksService.findAll(uid),
      this.ivrsService.findAll(uid),
      this.routesService.findAll(uid),
      this.contextsService.findAll(uid),
      this.directoriesService.findAll(uid),
      this.callGroupsService.findAll(uid),
    ]);
    return {
      queues,
      extensions: endpoints,
      trunks,
      ivrs,
      routes,
      contexts,
      directories,
      groups,
    };
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
      entityType: 'route',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: true,
    };
  }
}

function compactRoute(row: {
  uid?: number;
  context_uid?: number;
  name?: string;
  extensions?: string[];
  priority?: number;
  actions?: unknown;
}): Record<string, unknown> {
  return {
    uid: row.uid,
    context_uid: row.context_uid,
    name: row.name,
    extensions: row.extensions ?? [],
    priority: row.priority,
    destination: destinationOf(row.actions),
  };
}

function parseDialplanHost(value: unknown): DialplanHost | undefined {
  if (value === 'route' || value === 'ivr' || value === 'directory_policy') return value;
  return undefined;
}

function destinationOf(actions: unknown): string {
  if (!Array.isArray(actions) || actions.length === 0) return 'нет';
  const first = actions[0];
  if (!first || typeof first !== 'object') return 'нет';
  const rec = first as Record<string, unknown>;
  const type = String(rec.type || '');
  const params = (rec.params && typeof rec.params === 'object' ? rec.params : {}) as Record<string, unknown>;
  const target = readTarget(params);
  return target ? `${type} ${target}` : type || 'нет';
}

function readTarget(params: Record<string, unknown>): string | null {
  if (params.ivr_uid != null) return String(params.ivr_uid);
  if (typeof params.queue === 'string') return params.queue;
  if (typeof params.trunk === 'string') return params.trunk;
  if (typeof params.exten === 'string') return params.exten;
  if (typeof params.group === 'string') return params.group;
  const target = params.target;
  if (typeof target === 'string') return target;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const rec = target as Record<string, unknown>;
    if (rec.value != null) return String(rec.value);
  }
  return null;
}

function impactNote(proposed: string[], resulting: string[]): string | null {
  const touchesSensitive = proposed.some(
    (pattern) => isCatchAllPattern(pattern) || isEmergencyPattern(pattern) || isInboundPattern(pattern),
  );
  if (!touchesSensitive) return null;
  const inbound = resulting.filter((pattern) => isInboundPattern(pattern) || isSpecificNumericPattern(pattern));
  const emergency = resulting.filter((pattern) => isEmergencyPattern(pattern));
  const parts = ['Влияние: входящий или catch-all шаблон.'];
  if (inbound.length) parts.push(`Входящие: ${inbound.join(', ')}.`);
  if (emergency.length) parts.push(`Аварийные: ${emergency.join(', ')}.`);
  return parts.join(' ');
}

function isInboundPattern(pattern: string): boolean {
  if (isCatchAllPattern(pattern) || isEmergencyPattern(pattern)) return false;
  if (!isSpecificNumericPattern(pattern)) return false;
  const digits = pattern.replace(/\D/g, '');
  return digits.length >= 7;
}
