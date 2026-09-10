import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { toPublicExten, toPublicMemberInterface } from '../../shared/utils/tenant-public-id.util';
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
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

const STRATEGIES = ['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory'] as const;
const SCHEMA_VERSION = 'queues-1';

const memberSchema = z.strictObject({
  interface: z.string().min(1).describe('Интерфейс агента, например PJSIP/201'),
  membername: z.string().optional(),
  penalty: z.number().int().min(0).optional(),
});

const createInput = z.strictObject({
  name: z.string().min(1).describe('Отображаемое имя'),
  exten: z.string().min(1).describe('Номер очереди, 2–8 цифр'),
  strategy: z.enum(STRATEGIES).optional().describe(STRATEGIES.join(', ')),
  timeout: z.number().int().positive().optional(),
  overflow: z.string().optional().describe('Контекст overflow / Queue.context'),
  context: z.string().optional(),
  members: z.array(memberSchema).optional().describe('[{interface, membername, penalty}]'),
});

const createArgs = z.strictObject({
  exten: z.string().min(1),
  display_name: z.string().min(1),
  strategy: z.enum(STRATEGIES).default('ringall'),
  timeout: z.number().int().positive().optional(),
  context: z.string().optional(),
  members: z.array(memberSchema).optional(),
});

const updateInput = z.strictObject({
  name: z.string().optional().describe('Отображаемое имя или номер очереди'),
  exten: z.string().optional().describe('Номер очереди, 2–8 цифр'),
  strategy: z.enum(STRATEGIES).optional(),
  timeout: z.number().int().positive().optional(),
  overflow: z.string().optional().describe('Новый overflow-контекст'),
  context: z.string().optional(),
  members: z.array(memberSchema).optional(),
});

const updateArgs = z.strictObject({
  name: z.string().min(1),
  strategy: z.enum(STRATEGIES).optional(),
  timeout: z.number().int().positive().optional(),
  context: z.string().optional(),
  members: z.array(memberSchema).optional(),
});

const deleteInput = z.strictObject({
  name: z.string().optional().describe('Отображаемое имя или номер очереди'),
  exten: z.string().optional().describe('Номер очереди, 2–8 цифр'),
});

const deleteArgs = z.strictObject({ name: z.string().min(1) });

type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type UpdateInput = z.infer<typeof updateInput>;
type UpdateArgs = z.infer<typeof updateArgs>;
type DeleteInput = z.infer<typeof deleteInput>;
type DeleteArgs = z.infer<typeof deleteArgs>;
type MemberView = z.infer<typeof memberSchema>;

interface QueueView {
  name: string;
  display_name?: string;
  strategy?: string;
  timeout?: number;
  context?: string;
  exten?: string;
  members?: MemberView[];
}

/**
 * QueuesAiAdapter — queue mutations as proposals (D-15, D-18, D-27).
 * Name and tenant are passed separately; a name from one tenant never addresses another.
 * The canonical args store the resolved queue name, so a confirmation cannot be
 * re-pointed by renaming a queue after the card was built.
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
- Стратегии: ${STRATEGIES.join(', ')}. timeout — сколько звонящий ждёт агента; overflow (context) — куда он уходит, если очередь не взяла. Overflow очереди не заменяет цепочку пункта IVR после группы (totrunk / hangup).
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
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_queue',
      description: 'Предлагает создать очередь. overflow и члены проверяются по сущностям тенанта.',
      entityType: 'queue',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const overflow = overflowOf(input);
        const members = this.publicMembers(input.members, ctx.vpbxUserUid);
        const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
        if (refused) return refused;

        const applyArgs: CreateArgs = {
          exten: toPublicExten(input.exten, ctx.vpbxUserUid),
          display_name: input.name,
          strategy: input.strategy ?? 'ringall',
        };
        if (input.timeout != null) applyArgs.timeout = input.timeout;
        if (overflow) applyArgs.context = overflow;
        if (members.length) applyArgs.members = members;

        return this.proposal(
          'create_queue',
          input.name || applyArgs.exten,
          applyArgs,
          null,
          { ...applyArgs, overflow: overflow ?? null },
          [`Создать очередь ${applyArgs.display_name || applyArgs.exten}`],
        );
      },
      revalidate: (args, ctx) => this.revalidateRefs(args, args.context ?? null, args.members, ctx),
      apply: async (args, ctx) => {
        await this.queuesService.create(
          {
            ...args,
            exten: toPublicExten(args.exten, ctx.vpbxUserUid),
            members: this.publicMembers(args.members, ctx.vpbxUserUid),
          } as never,
          ctx.vpbxUserUid,
        );
      },
    });
  }

  private toolUpdateQueue(): AiToolDefinition {
    return defineMutationTool<UpdateInput, UpdateArgs>({
      name: 'update_queue',
      description:
        'Предлагает изменить очередь. Смена стратегии, состава или overflow — маршрутизация, не безопасная правка.',
      entityType: 'queue',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const name = await this.resolveQueueName(input, ctx.vpbxUserUid);
        const current = await this.queuesService.findOne(name, ctx.vpbxUserUid);
        const overflow = overflowOf(input);
        const members = input.members !== undefined
          ? this.publicMembers(input.members, ctx.vpbxUserUid)
          : undefined;
        const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
        if (refused) return refused;

        const applyArgs: UpdateArgs = { name };
        if (input.strategy != null) applyArgs.strategy = input.strategy;
        if (input.timeout != null) applyArgs.timeout = input.timeout;
        if (overflow) applyArgs.context = overflow;
        if (members) applyArgs.members = members;

        return this.proposal(
          'update_queue',
          String(current.display_name || current.name),
          applyArgs,
          this.snapshot(current),
          this.snapshot({ ...current, ...applyArgs, context: overflow ?? current.context }),
          this.updateSummary(current, applyArgs),
        );
      },
      revalidate: async (args, ctx) => {
        const owned = await this.requireQueue(args, args.name, ctx);
        if (!owned.ok) return owned;
        return this.revalidateRefs(args, args.context ?? null, args.members, ctx);
      },
      apply: async (args, ctx) => {
        const { name, ...rest } = args;
        const dto = rest.members
          ? { ...rest, members: this.publicMembers(rest.members, ctx.vpbxUserUid) }
          : rest;
        await this.queuesService.update(name, dto as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolDeleteQueue(): AiToolDefinition {
    return defineMutationTool<DeleteInput, DeleteArgs>({
      name: 'delete_queue',
      description: 'Предлагает удалить очередь по имени. В карточке — маршруты и меню, которые на неё шлют.',
      entityType: 'queue',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: deleteInput,
      args: deleteArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const name = await this.resolveQueueName(input, ctx.vpbxUserUid);
        const current = await this.queuesService.findOne(name, ctx.vpbxUserUid);
        const feeders = await this.feederNames(name, current.exten, ctx.vpbxUserUid);
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
      revalidate: (args, ctx) => this.requireQueue(args, args.name, ctx),
      apply: async (args, ctx) => {
        await this.queuesService.remove(args.name, ctx.vpbxUserUid);
      },
    });
  }

  private publicMembers(members: MemberView[] | undefined, uid: number): MemberView[] {
    return (members ?? []).map((member) => ({
      ...member,
      interface: toPublicMemberInterface(member.interface, uid),
    }));
  }

  private async requireQueue<T>(
    args: T,
    name: string,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    try {
      await this.queuesService.findOne(name, ctx.vpbxUserUid);
      return { ok: true, args };
    } catch {
      return { ok: false, reason: `Очередь ${name} не найдена у тенанта` };
    }
  }

  private async revalidateRefs<T>(
    args: T,
    overflow: string | null,
    members: MemberView[] | undefined,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
    if (refused) return { ok: false, reason: String(refused.message) };
    return { ok: true, args };
  }

  private updateSummary(current: QueueView, applyArgs: UpdateArgs): string[] {
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
  ): Promise<AiToolRefusal | null> {
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
    const exten = row.exten || toPublicExten(row.name);
    return {
      name: row.display_name || exten,
      exten,
      strategy: row.strategy,
      timeout: row.timeout,
      overflow: row.context ?? null,
      members: (row.members ?? []).map((member) => ({
        extension: toPublicExten(member.interface.split('/').pop() ?? member.interface),
        membername: member.membername,
        penalty: member.penalty,
      })),
    };
  }

  private async resolveQueueName(
    args: { name?: string; exten?: string },
    uid: number,
  ): Promise<string> {
    const rows = await this.queuesService.findAll(uid);
    const exten = toPublicExten(args.exten ?? '', uid);
    const label = (args.name ?? '').trim();
    const byExten = exten
      ? rows.find((row) => toPublicExten(row.name, uid) === exten || row.exten === exten)
      : undefined;
    if (byExten) return byExten.name;
    const byLabel = label
      ? rows.find((row) =>
          row.name === label
          || row.display_name === label
          || toPublicExten(row.name, uid) === toPublicExten(label, uid),
        )
      : undefined;
    if (byLabel) return byLabel.name;
    if (label) return label;
    throw new Error('Очередь не найдена у тенанта');
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

function overflowOf(input: { overflow?: string; context?: string }): string | null {
  if (input.overflow != null && input.overflow.trim()) return input.overflow;
  if (input.context != null && input.context.trim()) return input.context;
  return null;
}

function memberNames(members: MemberView[] | undefined): string[] {
  return (members ?? [])
    .map((member) => member.membername || member.interface)
    .filter(Boolean) as string[];
}

function memberResolves(
  iface: string,
  endpoints: Array<{ extension?: string; sipUsername?: string }>,
): boolean {
  const raw = String(iface || '');
  const id = toPublicExten(raw.replace(/^(PJSIP|SIP)\//i, ''));
  return endpoints.some((row) =>
    String(row.sipUsername) === id
    || String(row.extension) === id
    || toPublicExten(row.sipUsername) === id
    || raw.endsWith(`/${row.sipUsername}`)
    || raw.endsWith(`/${row.extension}`),
  );
}
