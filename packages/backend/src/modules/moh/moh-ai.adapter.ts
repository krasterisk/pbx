import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
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

interface MohClassView {
  name: string;
  displayName?: string;
  mode?: string;
  sort?: string;
  entries?: Array<{ position?: number; entry?: string }>;
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
    return {
      name: 'assign_moh_class',
      description:
        'Предлагает назначить класс очереди или маршруту. Класс должен принадлежать тенанту. Загрузка аудио недоступна.',
      inputSchema: {
        target_type: { type: 'string', description: 'queue | route' },
        target: { type: 'string', description: 'Имя очереди или uid маршрута' },
        class_name: { type: 'string', description: 'Имя класса музыки тенанта' },
      },
      entityType: 'moh',
      proposes: true,
      handler: async (args, uid) => {
        const className = String(args.class_name ?? '').trim();
        const owned = await this.requireOwnedClass(className, uid);
        if ('refused' in owned) return owned;

        const targetType = String(args.target_type ?? '').trim();
        const target = args.target;
        const resolved = await this.resolveTarget(targetType, target, uid);
        if ('refused' in resolved) return resolved;

        return this.proposal(
          'assign_moh_class',
          resolved.label,
          { target_type: targetType, target: resolved.target, class_name: className },
          { target: resolved.label, class: resolved.currentClass },
          { target: resolved.label, class: className },
          [
            `Назначить ${className} на ${resolved.label}`,
            `Сейчас: ${resolved.currentClass ?? '—'}`,
            `Будет: ${className}`,
          ],
        );
      },
    };
  }

  private async requireOwnedClass(
    className: string,
    uid: number,
  ): Promise<MohClassView | Record<string, unknown>> {
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
  ): Promise<
    | { label: string; target: string | number; currentClass: string | null }
    | Record<string, unknown>
  > {
    if (targetType === 'queue') {
      const name = String(target ?? '');
      const queue = await this.queuesService.findOne(name, uid);
      return {
        label: String(queue.display_name || queue.name),
        target: name,
        currentClass: queue.musiconhold ? String(queue.musiconhold) : null,
      };
    }
    if (targetType === 'route') {
      const routeUid = Number(target);
      const route = await this.routesService.findOne(routeUid, uid);
      const options = (route.options ?? {}) as Record<string, unknown>;
      return {
        label: String(route.name || routeUid),
        target: routeUid,
        currentClass: options.musiconhold != null ? String(options.musiconhold) : null,
      };
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
