import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContextsService } from './contexts.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/**
 * ContextsAiAdapter — read-only domain AI adapter for routing contexts.
 *
 * Every handler receives `vpbxUserUid` as a call parameter — never closed over (D-22).
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
    return [this.toolListContexts()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Контексты маршрутизации
- Контекст — именованный контейнер маршрутов тенанта. create_route требует uid контекста из list_contexts.
- Имя в Asterisk суффиксируется идентификатором тенанта; агент оперирует uid и отображаемым name, не сырым dialplan-именем.
- Контекст принадлежит ровно одному тенанту. Список всегда фильтруется параметром вызова, не аргументом модели.`;
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
}
