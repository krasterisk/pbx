import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TtsEnginesService } from './tts-engines.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/**
 * Explicit allow list — never project an engine by subtracting known secrets (T-15-86).
 * token, custom_url, custom_headers and encrypted blobs stay off this list.
 */
export const TTS_ENGINE_ALLOW_LIST = [
  'uid',
  'name',
  'vendor',
  'enabled',
  'capabilities',
  'configured',
] as const;

const CAPABILITY_KEYS = ['language', 'voice', 'speaking_rate', 'role', 'speed'] as const;

export type SpeechEngineRaw = {
  uid?: number;
  name?: string;
  type?: string;
  token?: string | null;
  custom_url?: string | null;
  settings?: Record<string, unknown> | null;
  enabled?: boolean | number;
};

export type SpeechEngineView = {
  uid: number | null;
  name: string;
  vendor: string;
  enabled: boolean;
  capabilities: Record<string, unknown>;
  configured: boolean;
};

/**
 * TtsEnginesAiAdapter — read-only TTS catalog (D-15).
 * Synthesis is billable with no undo — no synth tool is declared (T-15-88).
 */
@Injectable()
export class TtsEnginesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TtsEnginesAiAdapter.name);
  readonly domain = 'tts-engines';

  constructor(
    private readonly ttsEngines: TtsEnginesService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TtsEnginesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListTtsEngines()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## TTS-движки
- Каталог синтеза: имя, вендор, enabled, capabilities, configured. Ключ и URL не отдаются.
- Синтез через агента недоступен — это платная операция без отмены.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const engines = await this.ttsEngines.findAll(vpbxUserUid);
    if (engines.length === 0) return '';
    const ready = engines.filter((engine) => isSpeechEngineConfigured(engine)).length;
    return `TTS-движки: ${ready}/${engines.length} настроены`;
  }

  private toolListTtsEngines(): AiToolDefinition {
    return {
      name: 'list_tts_engines',
      description:
        'TTS-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Синтез недоступен.',
      inputSchema: {},
      entityType: 'tts_engine',
      handler: async (_args, uid) => {
        const rows = await this.ttsEngines.findAll(uid);
        return { engines: rows.map((row) => toTtsEngineView(row)) };
      },
    };
  }
}

export function toTtsEngineView(row: SpeechEngineRaw): SpeechEngineView {
  return toSpeechEngineView(row);
}

export function toSpeechEngineView(row: SpeechEngineRaw): SpeechEngineView {
  return {
    uid: row.uid ?? null,
    name: row.name ?? '',
    vendor: row.type ?? 'custom',
    enabled: row.enabled === false || row.enabled === 0 ? false : true,
    capabilities: pickCapabilities(row.settings),
    configured: isSpeechEngineConfigured(row),
  };
}

export function isSpeechEngineConfigured(row: SpeechEngineRaw): boolean {
  if (row.type === 'custom') {
    return Boolean(row.custom_url && String(row.custom_url).trim());
  }
  return Boolean(row.token && String(row.token).trim());
}

function pickCapabilities(settings: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const source = settings ?? {};
  const mapped: Record<string, unknown> = {
    language: source.language ?? source.language_code,
    voice: source.voice ?? source.voice_name,
    speaking_rate: source.speaking_rate,
    role: source.role,
    speed: source.speed,
  };
  const out: Record<string, unknown> = {};
  for (const key of CAPABILITY_KEYS) {
    const value = mapped[key];
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}
