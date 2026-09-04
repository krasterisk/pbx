import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { OPERATIONS_RESULT_CEILING } from '../notifications/notifications-ai.adapter';

export type PromptReferenceView = {
  entityType: 'ivr';
  uid: number;
  name: string;
};

export type PromptView = {
  uid: number;
  name: string;
  durationSeconds: number | null;
  referencedBy: PromptReferenceView[];
};

type PromptRaw = {
  uid?: number;
  comment?: string;
  name?: string;
  durationSeconds?: number;
  duration?: number;
  filename?: string;
};

type IvrRaw = {
  uid: number;
  name?: string;
  prompts?: Array<{ kind?: string; filename?: string }>;
};

/**
 * PromptsAiAdapter — read-only audio prompt metadata (D-15).
 * Results never include audio bytes or a fetchable path (T-15-92).
 */
@Injectable()
export class PromptsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(PromptsAiAdapter.name);
  readonly domain = 'prompts';

  constructor(
    private readonly prompts: PromptsService,
    private readonly registry: AiAdapterRegistryService,
    private readonly ivrs: IvrsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('PromptsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListAudioPrompts()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Аудиоподсказки
- Список: имя, длительность и какие меню на них ссылаются. Без аудио и без путей.
- Загрузить или синтезировать подсказку агент не может.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.prompts.findAll(vpbxUserUid);
    if (rows.length === 0) return '';
    const names = rows
      .slice(0, 5)
      .map((row) => String(row.comment || row.filename || row.uid))
      .join(', ');
    return `Аудиоподсказки: ${names}`;
  }

  private toolListAudioPrompts(): AiToolDefinition {
    return {
      name: 'list_audio_prompts',
      description:
        'Аудиоподсказки тенанта: имя, длительность и сущности, которые на них ссылаются. Без аудио и без путей.',
      inputSchema: {
        limit: {
          type: 'number',
          description: `Число строк, не больше ${OPERATIONS_RESULT_CEILING}`,
        },
      },
      entityType: 'prompt',
      handler: async (args, uid) => {
        const [rows, menus] = await Promise.all([
          this.prompts.findAll(uid),
          this.ivrs.findAll(uid),
        ]);
        const limit = clampOptional(args.limit, rows.length);
        return {
          prompts: toPromptViews(rows, menus as IvrRaw[]).slice(0, limit),
        };
      },
    };
  }
}

export function toPromptViews(
  rows: PromptRaw[] | null | undefined,
  ivrs: IvrRaw[] | null | undefined = [],
): PromptView[] {
  return (rows ?? []).map((row) => ({
    uid: Number(row.uid ?? 0),
    name: String(row.comment || row.name || ''),
    durationSeconds: durationOf(row),
    referencedBy: collectPromptReferences(String(row.filename ?? ''), ivrs ?? []),
  }));
}

export function collectPromptReferences(
  filename: string,
  ivrs: IvrRaw[],
): PromptReferenceView[] {
  const key = promptKey(filename);
  if (!key) return [];
  return ivrs
    .filter((ivr) =>
      (ivr.prompts ?? []).some(
        (phrase) => phrase.kind === 'audio' && promptKey(String(phrase.filename ?? '')) === key,
      ),
    )
    .map((ivr) => ({
      entityType: 'ivr' as const,
      uid: ivr.uid,
      name: String(ivr.name ?? ivr.uid),
    }));
}

function durationOf(row: PromptRaw): number | null {
  const value = row.durationSeconds ?? row.duration;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function promptKey(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  return base.replace(/\.[^.]+$/, '');
}

function clampOptional(limit: unknown, fallback: number): number {
  if (limit == null || limit === '') return fallback;
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), OPERATIONS_RESULT_CEILING);
}
