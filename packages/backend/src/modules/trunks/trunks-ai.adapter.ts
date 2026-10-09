import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { TrunksService } from './trunks.service';
import { RoutesService } from '../routes/routes.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';
import { ContextsService } from '../contexts/contexts.service';
import { selectConfigurationContext } from '../contexts/context-selection';
import { trunkConfigurationShape } from '../ai-platform/pbx-configuration.schemas';
import { redactSecrets } from '../ai-platform/ai-secret-redaction';

const SCHEMA_VERSION = 'trunks-2';

const trunkType = z.enum(['auth', 'ip']);

/** No `password` key anywhere: a provider secret is set on the trunk screen, not by the model. */
const createTrunkShape = {
  ...trunkConfigurationShape,
  name: z.string().min(1).describe('Имя транка ("МТТ", "Ростелеком")'),
  trunkType: trunkType.optional(),
  host: z.string().min(1).describe('Адрес SIP-сервера провайдера'),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  context: trunkConfigurationShape.context.describe('Имя из list_contexts; без значения нужен основной для транков.'),
  codecs: z.string().optional(),
  fromDomain: z.string().optional(),
};

const createTrunkInput = z.strictObject(createTrunkShape);
const createTrunkArgs = z.strictObject({
  ...createTrunkShape,
  trunkType: trunkType.default('ip'),
  context: z.string().trim().min(1),
  requiresSecureInput: z.boolean(),
});
const updateTrunkInput = z.strictObject({ trunkId: z.string().min(1), ...trunkConfigurationShape });
type UpdateTrunkInput = z.infer<typeof updateTrunkInput>;

const deleteTrunkInput = z.strictObject({
  trunkId: z.string().min(1).describe('ID транка (t_{name}_{tenantId})'),
});

type CreateTrunkInput = z.infer<typeof createTrunkInput>;
type CreateTrunkArgs = z.infer<typeof createTrunkArgs>;
type DeleteTrunkArgs = z.infer<typeof deleteTrunkInput>;

export interface TrunkRouteRef {
  uid: number;
  name: string;
}

/**
 * Re-check dependents at confirm time so a still-referenced trunk
 * surfaces route names instead of disappearing silently (T-15-41).
 */
export async function confirmTrunkDelete(
  trunksService: Pick<TrunksService, 'remove'>,
  routesService: Pick<RoutesService, 'findAll'>,
  trunkId: string,
  vpbxUserUid: number,
): Promise<{ ok: boolean; references?: TrunkRouteRef[] }> {
  const routes = await routesService.findAll(vpbxUserUid);
  const references = collectTrunkRouteRefs(routes, trunkId);
  if (references.length > 0) {
    return { ok: false, references };
  }
  await trunksService.remove(trunkId, vpbxUserUid);
  return { ok: true };
}

export function collectTrunkRouteRefs(
  routes: Array<{ uid?: number; name?: string; actions?: unknown }>,
  trunkId: string,
): TrunkRouteRef[] {
  const hits: TrunkRouteRef[] = [];
  for (const route of routes) {
    if (routeReferencesTrunk(route.actions, trunkId)) {
      hits.push({
        uid: Number(route.uid ?? 0),
        name: String(route.name || `#${route.uid ?? '?'}`),
      });
    }
  }
  return hits;
}

function routeReferencesTrunk(actions: unknown, trunkId: string): boolean {
  if (!Array.isArray(actions)) return false;
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    const rec = action as Record<string, unknown>;
    const params = (rec.params ?? {}) as Record<string, unknown>;
    if (matchesTrunk(params.trunk, trunkId) || matchesTrunk(params.trunkId, trunkId)) {
      return true;
    }
    if (Array.isArray(params.trunks)) {
      for (const item of params.trunks) {
        const row = item as Record<string, unknown>;
        if (matchesTrunk(row?.trunkId, trunkId) || matchesTrunk(row?.trunk, trunkId)) {
          return true;
        }
      }
    }
    if (JSON.stringify(rec).includes(trunkId)) return true;
  }
  return false;
}

function matchesTrunk(value: unknown, trunkId: string): boolean {
  if (value == null) return false;
  const text = String(value);
  return text === trunkId || text.endsWith(`/${trunkId}`) || text.includes(trunkId);
}

/** findAll exposes host; findOne nests it under registration / identify. */
function resolveTrunkHost(current: {
  host?: unknown;
  registration?: { server_uri?: string } | null;
  identify?: { match?: string } | null;
}): string {
  if (typeof current.host === 'string' && current.host) return current.host;
  const fromReg = current.registration?.server_uri?.replace(/^sip:/i, '').split('@').pop();
  if (fromReg) return fromReg;
  return current.identify?.match ?? '';
}

/**
 * TrunksAiAdapter — trunk mutations as proposals plus a read listing (D-15).
 */
@Injectable()
export class TrunksAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TrunksAiAdapter.name);
  readonly domain = 'trunks';

  constructor(
    private readonly trunksService: TrunksService,
    private readonly routesService: RoutesService,
    private readonly registry: AiAdapterRegistryService,
    private readonly contextsService: ContextsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TrunksAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListTrunks(), this.toolCreateTrunk(), this.toolDeleteTrunk(), this.toolGetTrunk(), this.toolUpdateTrunk()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Транки
- auth — регистрация у провайдера (логин/пароль). ip — пиринг по адресу, без регистрации.
- Хост и тип задаёт провайдер; агент не выдумывает их. Смена транка бьёт по живым звонкам.
- Удаление называет маршруты, которые ссылаются на транк.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const trunks = await this.trunksService.findAll(vpbxUserUid);
    if (trunks.length === 0) return '';
    return `Транки: ${trunks.map((trunk) => trunk.name).join(', ')}`;
  }

  private toolListTrunks(): AiToolDefinition {
    return {
      name: 'list_trunks',
      description: 'Список транков тенанта: id, имя, хост, тип (auth|ip). Без паролей.',
      inputSchema: {},
      entityType: 'trunk',
      handler: async (_args, uid) => {
        const trunks = await this.trunksService.findAll(uid);
        return {
          trunks: trunks.map((trunk) => ({
            id: trunk.id,
            name: trunk.name,
            host: trunk.host,
            trunkType: trunk.trunkType,
          })),
        };
      },
    };
  }

  private toolCreateTrunk(): AiToolDefinition {
    return defineMutationTool<CreateTrunkInput, CreateTrunkArgs>({
      name: 'create_trunk',
      description: 'Предлагает создать исходящий SIP-транк. Тип auth — регистрация, ip — пиринг.',
      entityType: 'trunk',
      schemaVersion: SCHEMA_VERSION,
      input: createTrunkInput,
      args: createTrunkArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const kind = input.trunkType ?? 'ip';
        const context = await selectConfigurationContext(this.contextsService, input.context, 'trunks', ctx);
        if (!context) return { refused: true, message: 'Выберите контекст из list_contexts или назначьте основной для транков.' };
        return this.proposal(
          'create_trunk',
          input.name,
          { ...input, context, trunkType: kind, requiresSecureInput: kind === 'auth' },
          null,
          { ...input, context, trunkType: kind, requiresSecureInput: kind === 'auth' },
          [`Создать транк «${input.name}» на хосте ${input.host} (${kind})`],
        );
      },
      revalidate: async (args, ctx) => {
        if (!await selectConfigurationContext(this.contextsService, args.context, 'trunks', ctx)) return { ok: false, reason: 'Контекст не найден в этом кабинете.' };
        const existing = await this.trunksService.findAll(ctx.vpbxUserUid);
        if (existing.some((trunk) => trunk.name === args.name)) {
          return { ok: false, reason: `Транк «${args.name}» уже есть у тенанта` };
        }
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        const { requiresSecureInput, ...settings } = args;
        if (requiresSecureInput && !ctx.secureInput?.password) throw new Error('secure_input_required');
        await this.trunksService.create({ ...settings, ...(requiresSecureInput ? { password: ctx.secureInput!.password } : {}) } as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolDeleteTrunk(): AiToolDefinition {
    return defineMutationTool<DeleteTrunkArgs, DeleteTrunkArgs>({
      name: 'delete_trunk',
      description: 'Предлагает удалить транк. В карточке — маршруты, которые на него ссылаются. Деструктивно.',
      entityType: 'trunk',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: deleteTrunkInput,
      args: deleteTrunkInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.trunksService.findOne(input.trunkId, ctx.vpbxUserUid);
        const routes = await this.routesService.findAll(ctx.vpbxUserUid);
        const references = collectTrunkRouteRefs(routes, input.trunkId);
        const refNames = references.map((row) => row.name).join(', ') || 'нет ссылающихся маршрутов';
        return this.proposal(
          'delete_trunk',
          current.name,
          { trunkId: input.trunkId },
          { id: current.id, name: current.name, host: resolveTrunkHost(current) },
          { referencedRoutes: references },
          [`Удалить транк «${current.name}» (${input.trunkId})`, `Маршруты, которые ссылаются: ${refNames}`],
        );
      },
      revalidate: async (args, ctx) => {
        try {
          await this.trunksService.findOne(args.trunkId, ctx.vpbxUserUid);
        } catch {
          return { ok: false, reason: `Транк ${args.trunkId} не найден у тенанта` };
        }
        const routes = await this.routesService.findAll(ctx.vpbxUserUid);
        const references = collectTrunkRouteRefs(routes, args.trunkId);
        if (references.length) {
          return {
            ok: false,
            reason: `На транк ссылаются маршруты: ${references.map((row) => row.name).join(', ')}`,
          };
        }
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        const result = await confirmTrunkDelete(
          this.trunksService,
          this.routesService,
          args.trunkId,
          ctx.vpbxUserUid,
        );
        if (!result.ok) {
          const names = (result.references ?? []).map((row) => row.name).join(', ');
          throw new Error(`Trunk is referenced by routes: ${names}`);
        }
      },
    });
  }

  private toolGetTrunk(): AiToolDefinition {
    return { name: 'get_trunk_configuration', description: 'Текущая полная конфигурация транка: endpoint, aor, registration, identify; секреты скрыты.',
      inputSchema: { trunkId: { type: 'string' } }, entityType: 'trunk',
      handler: async (args, uid) => redactSecrets(await this.trunksService.findOne(String(args.trunkId ?? ''), uid)) };
  }

  private toolUpdateTrunk(): AiToolDefinition {
    return defineMutationTool<UpdateTrunkInput, UpdateTrunkInput>({
      name: 'update_trunk', description: 'Изменить существующий SIP-транк: хост/порт, логин, контекст, транспорт, кодеки, From/Contact, identify, интервалы регистрации/qualify, лимит каналов, advanced PJSIP. Пароль сохраняется.',
      entityType: 'trunk', schemaVersion: SCHEMA_VERSION, input: updateTrunkInput, args: updateTrunkInput, reload: { kind: 'none' },
      propose: async (input, ctx) => {
        if (Object.keys(input).length < 2) return { refused: true, message: 'Не указано ни одного изменения.' };
        const current = await this.trunksService.findOne(input.trunkId, ctx.vpbxUserUid);
        if (input.context && !await selectConfigurationContext(this.contextsService, input.context, 'trunks', ctx)) return { refused: true, message: 'Контекст не найден в этом кабинете.' };
        const row = (await this.trunksService.findAll(ctx.vpbxUserUid)).find((trunk) => trunk.id === input.trunkId);
        const before = { ...redactSecrets(row ?? {}), advanced: redactSecrets(current.endpoint ?? {}) };
        return this.proposal('update_trunk', row?.name ?? input.trunkId, input, before, { ...before, ...input, advanced: { ...before.advanced, ...input.advanced } }, [`Изменить настройки транка «${row?.name ?? input.trunkId}»`]);
      },
      revalidate: async (args, ctx) => {
        await this.trunksService.findOne(args.trunkId, ctx.vpbxUserUid);
        if (args.context && !await selectConfigurationContext(this.contextsService, args.context, 'trunks', ctx)) return { ok: false, reason: 'Контекст не найден в этом кабинете.' };
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        const { trunkId, ...settings } = args;
        await this.trunksService.update(trunkId, settings as never, ctx.vpbxUserUid);
      },
    });
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
      entityType: 'trunk',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}
