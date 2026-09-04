import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SttEnginesService } from './stt-engines.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import {
  isSpeechEngineConfigured,
  toSpeechEngineView,
  type SpeechEngineRaw,
  type SpeechEngineView,
} from '../tts-engines/tts-engines-ai.adapter';

/**
 * Same allow list as TTS — engine rows store encrypted provider keys beside
 * harmless fields; subtracting secrets from a full row is what leaks a new column.
 */
export const STT_ENGINE_ALLOW_LIST = [
  'uid',
  'name',
  'vendor',
  'enabled',
  'capabilities',
  'configured',
] as const;

/**
 * SttEnginesAiAdapter — read-only STT catalog (D-15).
 * Transcription is billable with no undo — no transcribe tool is declared (T-15-88).
 */
@Injectable()
export class SttEnginesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(SttEnginesAiAdapter.name);
  readonly domain = 'stt-engines';

  constructor(
    private readonly sttEngines: SttEnginesService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('SttEnginesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListSttEngines()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## STT-движки
- Каталог распознавания: имя, вендор, enabled, capabilities, configured. Ключ и URL не отдаются.
- Транскрипция через агента недоступна — это платная операция без отмены.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const engines = await this.sttEngines.findAll(vpbxUserUid);
    if (engines.length === 0) return '';
    const ready = engines.filter((engine) => isSpeechEngineConfigured(engine)).length;
    return `STT-движки: ${ready}/${engines.length} настроены`;
  }

  private toolListSttEngines(): AiToolDefinition {
    return {
      name: 'list_stt_engines',
      description:
        'STT-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Транскрипция недоступна.',
      inputSchema: {},
      entityType: 'stt_engine',
      handler: async (_args, uid) => {
        const rows = await this.sttEngines.findAll(uid);
        return { engines: rows.map((row) => toSttEngineView(row)) };
      },
    };
  }
}

export function toSttEngineView(row: SpeechEngineRaw): SpeechEngineView {
  return toSpeechEngineView(row);
}
