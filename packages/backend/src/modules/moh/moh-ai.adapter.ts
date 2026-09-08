import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { MohService } from './moh.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
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

const SCHEMA_VERSION = 'moh-1';

const assignInput = z.strictObject({
  target_type: z.enum(['queue', 'route']).describe('queue | route'),
  target: z.union([z.string(), z.number()]).describe('Имя очереди или uid маршрута'),
  class_name: z.string().min(1).describe('Имя класса музыки тенанта'),
});

const assignArgs = z.strictObject({
  target_type: z.enum(['queue', 'route']),
  target: z.union([z.string(), z.number()]),
  class_name: z.string().min(1),
});

type AssignInput = z.infer<typeof assignInput>;
type AssignArgs = z.infer<typeof assignArgs>;

interface MohClassView {
  name: string;
  displayName?: string;
  mode?: string;
  sort?: string;
  entries?: Array<{ position?: number; entry?: string }>;
}

interface ResolvedMohTarget {
  label: string;
  target: string | number;
  currentClass: string | null;
}

/**
 * MohAiAdapter — hold-music reads and proposal-gated assignment (D-15, D-18).
 * Results are metadata only: no bytes, no fetchable paths (T-15-59).
 */
@Injectable()
export class MohAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(MohAiAdapter.name);
  readonly domain = 'moh';

  constructor(
    private readonly mohService: MohService,
    private readonly registry: AiAdapterRegistryService,
    private readonly queuesService: QueuesService,
    private readonly routesService: RoutesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('MohAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListClasses(), this.toolDescribeClass(), this.toolAssignClass()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Музыка на удержании
- Класс — именованный плейлист тенанта (mode/sort), не файл. Агент описывает и назначает, не загружает.
- Назначение: очередь (musiconhold) или маршрут (options.musiconhold). Чужой класс отвергается до карточки.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const classes = await this.mohService.findAll(vpbxUserUid);
    if (classes.length === 0) return '';
    const names = classes.map((row) => `${row.displayName || row.name} (${row.mode ?? 'playlist'})`).join(', ');
    return `Музыка на удержании: ${names}`;
  }

  private toolListClasses(): AiToolDefinition {
    return {
      name: 'list_moh_classes',
      description: 'Список классов музыки на удержании тенанта: режим и число треков. Без аудио.',
      inputSchema: {},
      entityType: 'moh',
      handler: async (_args, uid) => {
        const rows = await this.mohService.findAll(uid);
        return { classes: rows.map((row) => this.toListRow(row)) };
      },
    };
  }

  private toolDescribeClass(): AiToolDefinition {
    return {
      name: 'describe_moh_class',
      description: 'Один класс и упорядоченные имена треков. Без байтов и без путей к файлам.',
      inputSchema: { name: { type: 'string', description: 'Имя класса (moh_{tenant}_{slug})' } },
      entityType: 'moh',
      handler: async (args, uid) => {
        const current = await this.mohService.findOne(String(args.name), uid);
        return this.toDescribe(current);
      },
    };
  }

  private toolAssignClass(): AiToolDefinition {
    return defineMutationTool<AssignInput, AssignArgs>({
      name: 'assign_moh_class',
      description:
        'Предлагает назначить класс очереди или маршруту. Класс должен принадлежать тенанту. Загрузка аудио недоступна.',
      entityType: 'moh',
      schemaVersion: SCHEMA_VERSION,
      input: assignInput,
      args: assignArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => this.proposeAssign(input, ctx),
      revalidate: async (args, ctx) => this.revalidateAssign(args, ctx),
      apply: async (args, ctx) => this.applyAssign(args, ctx),
    });
  }

  private async proposeAssign(
    input: AssignInput,
    ctx: AiMutationContext,
  ): Promise<AgentDiffProposal | AiToolRefusal> {
    const owned = await this.requireOwnedClass(input.class_name, ctx.vpbxUserUid);
    if ('refused' in owned) return owned;

    const resolved = await this.resolveTarget(input.target_type, input.target, ctx.vpbxUserUid);
    if ('refused' in resolved) return resolved;

    return this.proposal(
      'assign_moh_class',
      resolved.label,
      {
        target_type: input.target_type,
        target: resolved.target,
        class_name: input.class_name,
      },
      { target: resolved.label, class: resolved.currentClass },
      { target: resolved.label, class: input.class_name },
      [
        `Назначить ${input.class_name} на ${resolved.label}`,
        `Сейчас: ${resolved.currentClass ?? '—'}`,
        `Будет: ${input.class_name}`,
      ],
    );
  }

  private async revalidateAssign(
    args: AssignArgs,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<AssignArgs>> {
    const owned = await this.requireOwnedClass(args.class_name, ctx.vpbxUserUid);
    if ('refused' in owned) {
      return { ok: false, reason: String(owned.message) };
    }
    const resolved = await this.resolveTarget(args.target_type, args.target, ctx.vpbxUserUid);
    if ('refused' in resolved) {
      return { ok: false, reason: String(resolved.message) };
    }
    return {
      ok: true as const,
      args: {
        target_type: args.target_type,
        target: resolved.target,
        class_name: args.class_name,
      },
    };
  }

  private async applyAssign(args: AssignArgs, ctx: AiMutationContext): Promise<void> {
    if (args.target_type === 'queue') {
      await this.queuesService.update(
        String(args.target),
        { musiconhold: args.class_name } as never,
        ctx.vpbxUserUid,
      );
      return;
    }

    const route = await this.routesService.findOne(Number(args.target), ctx.vpbxUserUid);
    const options = { ...((route.options ?? {}) as Record<string, unknown>), musiconhold: args.class_name };
    await this.routesService.update(Number(args.target), { options } as never, ctx.vpbxUserUid);
  }

  private async requireOwnedClass(
    className: string,
    uid: number,
  ): Promise<MohClassView | AiToolRefusal> {
    if (!className || /[\\/]/.test(className)) {
      return {
        refused: true,
        destination: className,
        message: `Класс ${className || '(пусто)'} не принадлежит тенанту`,
      };
    }
    try {
      return await this.mohService.findOne(className, uid);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return {
          refused: true,
          destination: className,
          message: `Класс ${className} не принадлежит тенанту`,
        };
      }
      throw err;
    }
  }

  private async resolveTarget(
    targetType: string,
    target: unknown,
    uid: number,
  ): Promise<ResolvedMohTarget | AiToolRefusal> {
    if (targetType === 'queue') {
      const name = String(target ?? '');
      try {
        const queue = await this.queuesService.findOne(name, uid);
        return {
          label: String(queue.display_name || queue.name),
          target: name,
          currentClass: queue.musiconhold ? String(queue.musiconhold) : null,
        };
      } catch {
        return {
          refused: true,
          destination: name,
          message: `Очередь ${name || '(пусто)'} не принадлежит тенанту`,
        };
      }
    }
    if (targetType === 'route') {
      const routeUid = Number(target);
      try {
        const route = await this.routesService.findOne(routeUid, uid);
        const options = (route.options ?? {}) as Record<string, unknown>;
        return {
          label: String(route.name || routeUid),
          target: routeUid,
          currentClass: options.musiconhold != null ? String(options.musiconhold) : null,
        };
      } catch {
        return {
          refused: true,
          destination: routeUid,
          message: `Маршрут ${routeUid} не принадлежит тенанту`,
        };
      }
    }
    return {
      refused: true,
      destination: targetType,
      message: `Назначить можно очередь или маршрут, не ${targetType}`,
    };
  }

  private toListRow(row: MohClassView): Record<string, unknown> {
    return {
      name: row.name,
      displayName: row.displayName ?? null,
      mode: row.mode ?? null,
      sort: row.sort ?? null,
      trackCount: (row.entries ?? []).length,
    };
  }

  private toDescribe(row: MohClassView): Record<string, unknown> {
    const tracks = [...(row.entries ?? [])]
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((entry) => ({
        position: Number(entry.position ?? 0),
        filename: trackFilename(String(entry.entry ?? '')),
      }));
    return {
      name: row.name,
      displayName: row.displayName ?? null,
      mode: row.mode ?? null,
      sort: row.sort ?? null,
      tracks,
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
      entityType: 'moh',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}

function trackFilename(entry: string): string {
  const parts = entry.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || entry;
}
