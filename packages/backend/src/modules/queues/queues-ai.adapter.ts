import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { ContextsService } from '../contexts/contexts.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';

const STRATEGIES = ['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory'] as const;

/**
 * QueuesAiAdapter — queue mutations as proposals (D-15, D-18, D-27).
 * Name and tenant are passed separately; a name from one tenant never addresses another.
 */
@Injectable()
export class QueuesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(QueuesAiAdapter.name);
  readonly domain = 'queues';

  constructor(
    private readonly queuesService: QueuesService,
    private readonly registry: AiAdapterRegistryService,
    private readonly contextsService: ContextsService,
    private readonly endpointsService: EndpointsService,
    private readonly routeReferencesService: RouteReferencesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('QueuesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListQueues(),
      this.toolCreateQueue(),
      this.toolUpdateQueue(),
      this.toolDeleteQueue(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Очереди
- Стратегии: ${STRATEGIES.join(', ')}. timeout — сколько звонящий ждёт агента; overflow (context) — куда он уходит, если очередь не взяла.
- Членство — interface абонента тенанта. Перед выводом о проблеме очереди читай live-состояние (get_pbx_state), не только конфиг.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const queues = await this.queuesService.findAll(vpbxUserUid);
    if (queues.length === 0) return '';
    const names = queues.map((queue) => queue.display_name || queue.name).join(', ');
    return `Очереди: ${names}`;
  }

  private toolListQueues(): AiToolDefinition {
    return {
      name: 'list_queues',
      description: 'Список очередей тенанта: стратегия, timeout, overflow и состав. Без изменений.',
      inputSchema: {},
      entityType: 'queue',
      handler: async (_args, uid) => {
        const rows = await this.queuesService.findAll(uid);
        const queues = [];
        for (const row of rows) {
          const detail = await this.safeFindOne(row.name, uid, row);
          queues.push(this.toListRow(detail));
        }
        return { queues };
      },
    };
  }

  private toolCreateQueue(): AiToolDefinition {
    return {
      name: 'create_queue',
      description: 'Предлагает создать очередь. overflow и члены проверяются по сущностям тенанта.',
      inputSchema: {
        name: { type: 'string', description: 'Отображаемое имя' },
        exten: { type: 'string', description: 'Номер очереди (q{exten}_{tenant})' },
        strategy: { type: 'string', description: STRATEGIES.join(', ') },
        timeout: { type: 'number' },
        overflow: { type: 'string', description: 'Контекст overflow / Queue.context' },
        context: { type: 'string' },
        members: { type: 'array', description: '[{interface, membername, penalty}]' },
      },
      entityType: 'queue',
      proposes: true,
      handler: async (args, uid) => {
        const overflow = overflowOf(args);
        const members = asMembers(args.members);
        const refused = await this.refuseBadRefs(overflow, members, uid);
        if (refused) return refused;

        const applyArgs: Record<string, unknown> = {
          exten: String(args.exten ?? args.name ?? ''),
          display_name: args.name != null ? String(args.name) : undefined,
          strategy: args.strategy != null ? String(args.strategy) : 'ringall',
        };
        if (args.timeout != null) applyArgs.timeout = Number(args.timeout);
        if (overflow) applyArgs.context = overflow;
        if (members.length) applyArgs.members = members;

        return this.proposal(
          'create_queue',
          String(args.name || applyArgs.exten),
          applyArgs,
          null,
          { ...applyArgs, overflow: overflow ?? null },
          [`Создать очередь ${applyArgs.display_name || applyArgs.exten}`],
        );
      },
    };
  }

  private toolUpdateQueue(): AiToolDefinition {
    return {
      name: 'update_queue',
      description:
        'Предлагает изменить очередь. Смена стратегии, состава или overflow — маршрутизация, не безопасная правка.',
      inputSchema: {
        name: { type: 'string', description: 'Имя очереди в БД (q{exten}_{tenant})' },
        strategy: { type: 'string' },
        timeout: { type: 'number' },
        overflow: { type: 'string', description: 'Новый overflow-контекст' },
        context: { type: 'string' },
        members: { type: 'array' },
      },
      entityType: 'queue',
      proposes: true,
      handler: async (args, uid) => {
        const name = String(args.name);
        const current = await this.queuesService.findOne(name, uid);
        const overflow = overflowOf(args);
        const members = args.members !== undefined ? asMembers(args.members) : undefined;
        const refused = await this.refuseBadRefs(overflow, members, uid);
        if (refused) return refused;

        const applyArgs: Record<string, unknown> = { name };
        if (args.strategy != null) applyArgs.strategy = String(args.strategy);
        if (args.timeout != null) applyArgs.timeout = Number(args.timeout);
        if (overflow) applyArgs.context = overflow;
        if (members) applyArgs.members = members;

        const summary = this.updateSummary(current, applyArgs);
        return this.proposal(
          'update_queue',
          String(current.display_name || current.name),
          applyArgs,
          this.snapshot(current),
          this.snapshot({ ...current, ...applyArgs, context: overflow ?? current.context }),
          summary,
        );
      },
    };
  }

  private toolDeleteQueue(): AiToolDefinition {
    return {
      name: 'delete_queue',
      description: 'Предлагает удалить очередь по имени. В карточке — маршруты и меню, которые на неё шлют.',
      inputSchema: {
        name: { type: 'string', description: 'Имя очереди (q{exten}_{tenant})' },
      },
      entityType: 'queue',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const name = String(args.name);
        const current = await this.queuesService.findOne(name, uid);
        const feeders = await this.feederNames(name, current.exten, uid);
        const summary = [
          `Удалить очередь ${current.display_name || name}`,
          ...feeders.routes.map((route) => `Маршрут: ${route}`),
          ...feeders.menus.map((menu) => `Меню: ${menu}`),
        ];
        return this.proposal(
          'delete_queue',
          String(current.display_name || name),
          { name },
          this.snapshot(current),
          null,
          summary,
        );
      },
    };
  }

  private updateSummary(current: QueueView, applyArgs: Record<string, unknown>): string[] {
    const lines: string[] = [];
    if (applyArgs.timeout != null && Number(applyArgs.timeout) !== Number(current.timeout)) {
      lines.push(`timeout: ${current.timeout ?? '—'} → ${applyArgs.timeout}`);
    }
    if (applyArgs.strategy != null && String(applyArgs.strategy) !== String(current.strategy ?? '')) {
      lines.push(`strategy: ${current.strategy ?? '—'} → ${applyArgs.strategy}`);
    }
    const nextOverflow = applyArgs.context != null ? String(applyArgs.context) : current.context;
    if (applyArgs.context != null && String(applyArgs.context) !== String(current.context ?? '')) {
      lines.push(`overflow: ${current.context ?? '—'} → ${applyArgs.context}`);
    } else if (nextOverflow) {
      lines.push(`overflow: ${nextOverflow}`);
    }
    const membershipTouched = applyArgs.members !== undefined || applyArgs.strategy != null;
    if (membershipTouched) {
      const agents = memberNames(current.members);
      if (agents.length) lines.push(`Агенты: ${agents.join(', ')}`);
    }
    if (lines.length === 0) {
      lines.push(`Изменить очередь ${current.display_name || current.name}`);
    }
    return lines;
  }

  private async refuseBadRefs(
    overflow: string | null,
    members: MemberView[] | undefined,
    uid: number,
  ): Promise<Record<string, unknown> | null> {
    if (overflow) {
      const contexts = await this.contextsService.findAll(uid);
      const ok = contexts.some((context) => context.name === overflow || String(context.uid) === overflow);
      if (!ok) {
        return {
          refused: true,
          destination: overflow,
          message: `Overflow указывает на несуществующее назначение ${overflow}`,
        };
      }
    }
    if (members?.length) {
      const endpoints = await this.endpointsService.findAll(uid);
      for (const member of members) {
        if (!memberResolves(member.interface, endpoints)) {
          return {
            refused: true,
            destination: member.interface,
            message: `Член очереди ${member.interface} не найден у тенанта`,
          };
        }
      }
    }
    return null;
  }

  private async feederNames(
    name: string,
    exten: string | undefined,
    uid: number,
  ): Promise<{ routes: string[]; menus: string[] }> {
    const keys = [name, exten, exten ? `q${exten}` : ''].filter(Boolean) as string[];
    const routes = new Set<string>();
    const menus = new Set<string>();
    for (const key of keys) {
      const usage = await this.routeReferencesService.findUsage('queue', key, uid);
      for (const ref of usage.references ?? []) {
        if (ref.routeName) routes.add(ref.routeName);
        if (ref.ivrName) menus.add(ref.ivrName);
      }
    }
    return { routes: [...routes], menus: [...menus] };
  }

  private async safeFindOne(name: string, uid: number, fallback: QueueView): Promise<QueueView> {
    try {
      return await this.queuesService.findOne(name, uid);
    } catch {
      return fallback;
    }
  }

  private toListRow(row: QueueView): Record<string, unknown> {
    return {
      name: row.name,
      display_name: row.display_name,
      strategy: row.strategy,
      timeout: row.timeout,
      overflow: row.context ?? null,
      members: (row.members ?? []).map((member) => ({
        interface: member.interface,
        membername: member.membername,
        penalty: member.penalty,
      })),
    };
  }

  private snapshot(row: QueueView): Record<string, unknown> {
    return {
      name: row.name,
      strategy: row.strategy ?? null,
      timeout: row.timeout ?? null,
      overflow: row.context ?? null,
      members: memberNames(row.members),
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
      entityType: 'queue',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}

interface MemberView {
  interface: string;
  membername?: string;
  penalty?: number;
}

interface QueueView {
  name: string;
  display_name?: string;
  strategy?: string;
  timeout?: number;
  context?: string;
  exten?: string;
  members?: MemberView[];
}

function overflowOf(args: Record<string, unknown>): string | null {
  if (args.overflow != null && String(args.overflow).trim()) return String(args.overflow);
  if (args.context != null && String(args.context).trim()) return String(args.context);
  return null;
}

function asMembers(value: unknown): MemberView[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        interface: String(rec.interface ?? ''),
        membername: rec.membername != null ? String(rec.membername) : undefined,
        penalty: rec.penalty != null ? Number(rec.penalty) : undefined,
      };
    });
}

function memberNames(members: MemberView[] | undefined): string[] {
  return (members ?? [])
    .map((member) => member.membername || member.interface)
    .filter(Boolean);
}

function memberResolves(
  iface: string,
  endpoints: Array<{ extension?: string; sipUsername?: string }>,
): boolean {
  const raw = String(iface || '');
  const id = raw.replace(/^(PJSIP|SIP)\//i, '');
  return endpoints.some((row) =>
    String(row.sipUsername) === id
    || String(row.extension) === id
    || raw.endsWith(`/${row.sipUsername}`)
    || raw.endsWith(`/${row.extension}`),
  );
}
