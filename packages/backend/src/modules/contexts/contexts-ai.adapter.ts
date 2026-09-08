import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { ContextsService } from './contexts.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AgentDiffProposal,
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import {
  AiMutationContext,
  defineMutationTool,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

const SCHEMA_VERSION = 'contexts-1';

const createInput = z.strictObject({
  name: z.string().min(1).max(64),
  comment: z.string().max(255).optional(),
});
const updateInput = z.strictObject({
  uid: z.number().int().positive(),
  name: z.string().min(1).max(64).optional(),
  comment: z.string().max(255).optional(),
});
const byUid = z.strictObject({
  uid: z.number().int().positive(),
});

type CreateArgs = z.infer<typeof createInput>;
type UpdateArgs = z.infer<typeof updateInput>;
type ByUid = z.infer<typeof byUid>;

/**
 * ContextsAiAdapter — list + CRUD mutations for routing contexts (tenant UI parity).
 */
@Injectable()
export class ContextsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(ContextsAiAdapter.name);
  readonly domain = 'contexts';

  constructor(
    private readonly contextsService: ContextsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ContextsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListContexts(),
      this.toolCreateContext(),
      this.toolUpdateContext(),
      this.toolDeleteContext(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Контексты маршрутизации
- Контекст — именованный контейнер маршрутов тенанта. create_route требует uid контекста из list_contexts.
- Имя в Asterisk суффиксируется идентификатором тенанта; агент оперирует uid и отображаемым name, не сырым dialplan-именем.
- Контекст принадлежит ровно одному тенанту. Список всегда фильтруется параметром вызова, не аргументом модели.
- Не выдумывай UID контекста — создай через create_context или возьми из list_contexts.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const contexts = await this.contextsService.findAll(vpbxUserUid);
    if (contexts.length === 0) return '';
    const names = contexts.map((context) => context.name).join(', ');
    return `Контексты: ${names}`;
  }

  private toolListContexts(): AiToolDefinition {
    return {
      name: 'list_contexts',
      description: 'Возвращает все контексты маршрутизации с UID. Используй перед create_route.',
      inputSchema: {},
      entityType: 'context',
      handler: async (_args, uid) => {
        const contexts = await this.contextsService.findAll(uid);
        return {
          contexts: contexts.map((context) => ({
            uid: context.uid,
            name: context.name,
            comment: context.comment,
          })),
        };
      },
    };
  }

  private toolCreateContext(): AiToolDefinition {
    return defineMutationTool<CreateArgs, CreateArgs>({
      name: 'create_context',
      description: 'Создаёт контекст маршрутизации. Нужны name и опциональный comment.',
      entityType: 'context',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createInput,
      reload: { kind: 'none' },
      propose: async (input) => this.proposal('create_context', input.name, input, null, input, [
        `Создать контекст «${input.name}»`,
      ]),
      revalidate: async (args) => ({ ok: true, args }),
      apply: async (args, ctx) => {
        await this.contextsService.create(args, ctx.vpbxUserUid);
      },
    });
  }

  private toolUpdateContext(): AiToolDefinition {
    return defineMutationTool<UpdateArgs, UpdateArgs>({
      name: 'update_context',
      description: 'Изменяет имя или комментарий контекста по uid.',
      entityType: 'context',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.contextsService.findOne(input.uid, ctx.vpbxUserUid);
        return this.proposal(
          'update_context',
          current.name,
          input,
          { uid: current.uid, name: current.name, comment: current.comment },
          { uid: current.uid, name: input.name ?? current.name, comment: input.comment ?? current.comment },
          [`Изменить контекст «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireContext(args, args.uid, ctx),
      apply: async (args, ctx) => {
        const { uid, ...rest } = args;
        await this.contextsService.update(uid, rest, ctx.vpbxUserUid);
      },
    });
  }

  private toolDeleteContext(): AiToolDefinition {
    return defineMutationTool<ByUid, ByUid>({
      name: 'delete_context',
      description: 'Удаляет контекст по uid. Деструктивная операция.',
      entityType: 'context',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: byUid,
      args: byUid,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.contextsService.findOne(input.uid, ctx.vpbxUserUid);
        return this.proposal(
          'delete_context',
          current.name,
          input,
          { uid: current.uid, name: current.name, comment: current.comment },
          null,
          [`Удалить контекст «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireContext(args, args.uid, ctx),
      apply: async (args, ctx) => {
        await this.contextsService.remove(args.uid, ctx.vpbxUserUid);
      },
    });
  }

  private async requireContext<T extends { uid: number }>(
    args: T,
    uid: number,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    try {
      await this.contextsService.findOne(uid, ctx.vpbxUserUid);
      return { ok: true, args };
    } catch (err: any) {
      return { ok: false, reason: err?.message ?? 'context not found' };
    }
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
      entityType: 'context',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}
