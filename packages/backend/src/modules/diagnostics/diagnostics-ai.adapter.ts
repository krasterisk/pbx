import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { DiagnosticsService } from './diagnostics.service';

/**
 * DiagnosticsAiAdapter — read-only live channels, recent events, compiled dialplan (D-12, D-13).
 * Tenant is a handler argument, never a registration closure (D-22).
 */
@Injectable()
export class DiagnosticsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(DiagnosticsAiAdapter.name);
  readonly domain = 'diagnostics';

  constructor(
    private readonly diagnostics: DiagnosticsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('DiagnosticsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolLiveChannels(), this.toolRecentEvents(), this.toolCompiledDialplan()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }

  getKnowledgeBlock(): string {
    return `## Диагностика
- Живые каналы, недавние события и скомпилированный диалплан — доказательства, не догадки.
- Порядок правил в get_compiled_dialplan — порядок оценки. Чужой контекст отвергается.
- Списки усекаются; truncated значит «спроси уже», а не «вызова не было».`;
  }

  private toolLiveChannels(): AiToolDefinition {
    return {
      name: 'get_live_channels',
      description:
        'Живые каналы вызывающего тенанта. Общий свитч фильтруется по своим контекстам и endpoint. Усечение сообщается.',
      inputSchema: {},
      entityType: 'diagnostic_channel',
      handler: async (_args, uid) => this.diagnostics.readLiveChannels(uid),
    };
  }

  private toolRecentEvents(): AiToolDefinition {
    return {
      name: 'get_recent_call_events',
      description:
        'Недавние события звонков тенанта в ограниченном окне и количестве. Не причина сама по себе — только улика.',
      inputSchema: {},
      entityType: 'diagnostic_event',
      handler: async (_args, uid) => this.diagnostics.readRecentEvents(uid),
    };
  }

  private toolCompiledDialplan(): AiToolDefinition {
    return {
      name: 'get_compiled_dialplan',
      description:
        'Скомпилированные правила одного своего контекста в порядке оценки. Чужой контекст отвергается.',
      inputSchema: {
        context: { type: 'string', description: 'Имя контекста тенанта, как в list_contexts' },
      },
      entityType: 'diagnostic_dialplan',
      handler: async (args, uid) => this.diagnostics.readCompiledDialplan(uid, String(args.context ?? '')),
    };
  }
}
