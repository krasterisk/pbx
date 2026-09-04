import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TrunksService } from './trunks.service';
import { RoutesService } from '../routes/routes.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';

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
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TrunksAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListTrunks(), this.toolCreateTrunk(), this.toolDeleteTrunk()];
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
    return {
      name: 'create_trunk',
      description: 'Предлагает создать исходящий SIP-транк. Тип auth — регистрация, ip — пиринг.',
      inputSchema: {
        name: { type: 'string', description: 'Имя транка ("МТТ", "Ростелеком")' },
        trunkType: { type: 'string', enum: ['auth', 'ip'] },
        host: { type: 'string', description: 'Адрес SIP-сервера провайдера' },
        port: { type: 'number' },
        username: { type: 'string' },
        context: { type: 'string', description: 'Контекст для входящих (from-trunk)' },
        codecs: { type: 'string' },
        fromDomain: { type: 'string' },
      },
      entityType: 'trunk',
      proposes: true,
      handler: async (args) => {
        const name = String(args.name ?? 'trunk');
        const host = String(args.host ?? '');
        const trunkType = String(args.trunkType ?? 'ip');
        const applyArgs: Record<string, unknown> = { ...args, name, host, trunkType };
        delete applyArgs.password;
        return this.proposal(
          'create_trunk',
          name,
          applyArgs,
          null,
          { name, host, trunkType },
          [`Создать транк «${name}» на хосте ${host} (${trunkType})`],
        );
      },
    };
  }

  private toolDeleteTrunk(): AiToolDefinition {
    return {
      name: 'delete_trunk',
      description: 'Предлагает удалить транк. В карточке — маршруты, которые на него ссылаются. Деструктивно.',
      inputSchema: { trunkId: { type: 'string', description: 'ID транка (t_{name}_{tenantId})' } },
      entityType: 'trunk',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const trunkId = String(args.trunkId);
        const current = await this.trunksService.findOne(trunkId, uid);
        const routes = await this.routesService.findAll(uid);
        const references = collectTrunkRouteRefs(routes, trunkId);
        const refNames = references.map((row) => row.name).join(', ') || 'нет ссылающихся маршрутов';
        return this.proposal(
          'delete_trunk',
          current.name,
          { trunkId },
          { id: current.id, name: current.name, host: current.host },
          { referencedRoutes: references },
          [`Удалить транк «${current.name}» (${trunkId})`, `Маршруты, которые ссылаются: ${refNames}`],
        );
      },
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
