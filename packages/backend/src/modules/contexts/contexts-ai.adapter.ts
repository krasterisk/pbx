import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RouteApplyService } from '../routes/route-apply.service';
import { z } from 'zod';
import { CONTEXT_IDENTIFIER_PATTERN, CONTEXT_IDENTIFIER_MAX_LENGTH, CONTEXT_IDENTIFIER_ERROR } from '@krasterisk/shared';
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
  jsonSchemaOf,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

const SCHEMA_VERSION = 'contexts-5';
const contextIdentifier = z.string().min(1).max(CONTEXT_IDENTIFIER_MAX_LENGTH)
  .regex(CONTEXT_IDENTIFIER_PATTERN, CONTEXT_IDENTIFIER_ERROR)
  .describe('Технический идентификатор: 1–64 символа, строчная латинская буква в начале, затем строчная латиница и цифры; одиночные дефисы/подчёркивания между частями, без пробелов. Например from-internal. Русское название — в comment');
const defaultFlags = {
  include_uids: z.array(z.number().int().positive()).max(100).refine((uids) => new Set(uids).size === uids.length, 'Duplicate includes').optional().describe('Полная замена списка включений: UID контекстов кабинета в порядке поиска. [] удаляет включения; отсутствие поля сохраняет их. Собственные правила раньше включений, вложения в глубину; циклы запрещены'),
  is_default_for_endpoints: z.boolean().optional().describe('Основной контекст новых абонентов; сначала снимите признак у прежнего основного'),
  is_default_for_trunks: z.boolean().optional().describe('Основной контекст новых транков; сначала снимите признак у прежнего основного'),
};

const createInput = z.strictObject({
  name: contextIdentifier,
  comment: z.string().max(128).optional(),
  ...defaultFlags,
});
const updateInput = z.strictObject({
  uid: z.number().int().positive(),
  name: contextIdentifier.optional(),
  comment: z.string().max(128).optional(),
  ...defaultFlags,
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
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ContextsAiAdapter registered');
  }

  private async applyContext(uid: number, ctx: AiMutationContext): Promise<void> {
    const moduleRef = this.moduleRef;
    if (moduleRef) {
      try {
        const result = await moduleRef.get(RouteApplyService, { strict: false }).applyContext(uid, ctx.vpbxUserUid, ctx.isAdmin === true);
        if (!result.success) throw new Error('Dialplan apply failed');
      } catch {
        throw new Error(`Context saved (uid=${uid}) but dialplan apply failed; use apply_context with this UID, do not repeat create`);
      }
    }
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListContexts(),
      this.toolGetContextConfiguration(),
      this.toolApplyContext(),
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
- Не выдумывай UID контекста — создай через create_context или возьми из list_contexts.
- include_uids полностью заменяет упорядоченные включения; [] снимает наследование. get_context_configuration показывает граф и порядок поиска.
- Собственные правила раньше include; вложения обходятся в глубину. Это область обычного набора абонента; контекст транка задаёт входящий поиск. Прямой Dial/Goto не ограничивается этим графом.
- Route Type (permissions) больше не используется. include не является резервированием транков.
- Изменения требуют подтверждения. Если БД сохранена, но АТС не применена, повтори подтверждение при switch_failed либо предложи apply_context по существующему UID, не создавай сущность заново.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const contexts = await this.contextsService.findAll(vpbxUserUid);
    if (contexts.length === 0) return '';
    const names = contexts.slice(0, 20).map((context) => `${context.uid}:${context.name} include=[${(context.include_uids ?? []).slice(0, 10).join(',')}${(context.include_uids?.length ?? 0) > 10 ? ',…' : ''}]`).join('; ');
    return `Контексты: ${names}`;
  }

  private toolListContexts(): AiToolDefinition {
    return {
      name: 'list_contexts',
      description: 'Контексты кабинета: UID, имена, упорядоченные include_uids и основные назначения. Читать перед настройкой маршрутов, абонентов, транков или включений.',
      inputSchema: {},
      entityType: 'context',
      handler: async (_args, uid) => {
        const contexts = await this.contextsService.findAll(uid);
        return {
          contexts: contexts.map((context) => ({
            uid: context.uid,
            name: context.name,
            comment: context.comment,
            include_uids: context.include_uids,
            is_default_for_endpoints: context.is_default_for_endpoints,
            is_default_for_trunks: context.is_default_for_trunks,
          })),
        };
      },
    };
  }

  private async configuration(uid: number, tenant: number, includes?: number[]) {
    const contexts = await this.contextsService.findAll(tenant);
    const root = contexts.find((context) => context.uid === uid);
    if (!root) throw new Error('Context not found');
    return this.describeGraph(contexts, { uid: root.uid, name: root.name, include_uids: includes ?? root.include_uids ?? [] });
  }

  private describeGraph(
    contexts: Array<{ uid: number; name: string; include_uids?: number[] }>,
    root: { uid: number; name: string; include_uids?: number[] },
  ) {
    const graph = new Map(contexts.map((context) => [context.uid, context]));
    graph.set(root.uid, root);
    const active = new Set<number>();
    const visited = new Set<number>();
    const searchOrder: Array<{ uid: number; name: string }> = [];
    const visit = (uid: number) => {
      if (active.has(uid)) throw new Error('Context include cycle');
      if (visited.has(uid)) return;
      const node = graph.get(uid);
      if (!node) throw new Error('Included context not found in this tenant');
      active.add(uid);
      searchOrder.push({ uid, name: node.name });
      for (const child of node.include_uids ?? []) visit(child);
      active.delete(uid);
      visited.add(uid);
    };
    visit(root.uid);
    return {
      uid: root.uid, name: root.name, include_uids: root.include_uids ?? [],
      ordered_includes: (root.include_uids ?? []).map((uid) => ({ uid, name: graph.get(uid)!.name })),
      search_order: searchOrder,
      semantics: 'Own context first, ordered depth-first includes. Within a context Asterisk matches exact extensions before patterns; include order is not trunk failover or a Dial/Goto restriction.',
    };
  }

  private toolGetContextConfiguration(): AiToolDefinition {
    return {
      name: 'get_context_configuration',
      description: 'Читает включения контекста с именами и эффективный порядок поиска: свой контекст, затем include в глубину. Не симулирует вызов и не проверяет состояние АТС.',
      entityType: 'context', inputSchema: jsonSchemaOf(byUid).properties,
      handler: async (args, tenant) => this.configuration(byUid.parse(args).uid, tenant),
    };
  }

  private toolApplyContext(): AiToolDefinition {
    return defineMutationTool<ByUid, ByUid>({
      name: 'apply_context',
      description: 'После подтверждения повторно применяет существующий контекст и его включения в АТС без повторного создания или изменения БД. Используй после ошибки применения.',
      entityType: 'context', schemaVersion: SCHEMA_VERSION, input: byUid, args: byUid,
      reload: { kind: 'dialplan-context', contextUid: (args: ByUid) => args.uid },
      propose: async (input, ctx) => {
        const config = await this.configuration(input.uid, ctx.vpbxUserUid);
        return this.proposal('apply_context', config.name, input, config, config, [`Применить контекст «${config.name}» в АТС без изменения БД`]);
      },
      revalidate: (args, ctx) => this.requireContext(args, args.uid, ctx),
      apply: async () => undefined,
    });
  }

  private toolCreateContext(): AiToolDefinition {
    return defineMutationTool<CreateArgs, CreateArgs>({
      name: 'create_context',
      description: 'Создаёт контекст: name, comment, упорядоченные include_uids и основные назначения. Свои правила раньше включений; циклы и чужие UID запрещены. Применяет в АТС после подтверждения.',
      entityType: 'context',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const graph = this.describeGraph(await this.contextsService.findAll(ctx.vpbxUserUid), { uid: -1, name: input.name, include_uids: input.include_uids ?? [] });
        return this.proposal('create_context', input.name, input, null, { ...input, ordered_includes: graph.ordered_includes }, [`Создать контекст «${input.name}»`, `Включения по порядку: ${graph.ordered_includes.map((node) => node.name).join(' → ') || 'нет'}`]);
      },
      revalidate: async (args, ctx) => {
        try {
          this.describeGraph(await this.contextsService.findAll(ctx.vpbxUserUid), { uid: -1, name: args.name, include_uids: args.include_uids ?? [] });
          return { ok: true, args };
        } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error) }; }
      },
      apply: async (args, ctx) => {
        const created = await this.contextsService.create(args, ctx.vpbxUserUid);
        await this.applyContext(created.uid, ctx);
        return { uid: created.uid, name: created.name };
      },
    });
  }

  private toolUpdateContext(): AiToolDefinition {
    return defineMutationTool<UpdateArgs, UpdateArgs>({
      name: 'update_context',
      description: 'Изменяет контекст по uid; include_uids — весь новый порядок, [] убирает включения. Без поля включения сохраняются. Основной сменяется двумя шагами: снять прежний, назначить новый. Подтверждение применяет в АТС.',
      entityType: 'context',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateInput,
      reload: { kind: 'dialplan-context', contextUid: (args: UpdateArgs) => args.uid },
      propose: async (input, ctx) => {
        const current = await this.contextsService.findOne(input.uid, ctx.vpbxUserUid);
        const beforeGraph = await this.configuration(input.uid, ctx.vpbxUserUid);
        const afterGraph = await this.configuration(input.uid, ctx.vpbxUserUid, input.include_uids);
        return this.proposal(
          'update_context',
          current.name,
          input,
          { uid: current.uid, name: current.name, comment: current.comment, include_uids: current.include_uids, ordered_includes: beforeGraph.ordered_includes, is_default_for_endpoints: current.is_default_for_endpoints, is_default_for_trunks: current.is_default_for_trunks },
          { uid: current.uid, name: input.name ?? current.name, comment: input.comment ?? current.comment,
            include_uids: input.include_uids ?? current.include_uids,
            ordered_includes: afterGraph.ordered_includes,
            is_default_for_endpoints: input.is_default_for_endpoints ?? current.is_default_for_endpoints,
            is_default_for_trunks: input.is_default_for_trunks ?? current.is_default_for_trunks },
          [`Изменить контекст «${current.name}»`, `Включения по порядку: ${afterGraph.ordered_includes.map((node) => node.name).join(' → ') || 'нет'}`],
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
        const moduleRef = this.moduleRef;
        const current = moduleRef ? await this.contextsService.findOne(args.uid, ctx.vpbxUserUid) : null;
        const parents = moduleRef ? (await this.contextsService.findAll(ctx.vpbxUserUid)).filter((context) => context.include_uids?.includes(args.uid)) : [];
        await this.contextsService.remove(args.uid, ctx.vpbxUserUid);
        if (current && moduleRef) {
          await moduleRef.get(RouteApplyService, { strict: false }).clearContext(current.name, ctx.vpbxUserUid);
          for (const parent of parents) await this.applyContext(parent.uid, ctx);
        }
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
      await this.configuration(uid, ctx.vpbxUserUid, (args as T & { include_uids?: number[] }).include_uids);
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
      includesDialplanReload: true,
    };
  }
}
