import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

export type PlatformProjectionEntry = {
  key: 'recordings_available' | 'recordings_tenant_prefix' | 'webhook_configured';
  explanation: string;
};

/**
 * Explicit tenant-facing projection — a new platform setting is invisible until listed (T-15-78).
 * Never pass through findAll() or getServerConfigRaw().
 */
export const PLATFORM_TENANT_PROJECTION: readonly PlatformProjectionEntry[] = [
  {
    key: 'recordings_available',
    explanation: 'Whether this tenant can play call recordings from stored files',
  },
  {
    key: 'recordings_tenant_prefix',
    explanation: 'Relative recordings prefix for this tenant, not the server store root',
  },
  {
    key: 'webhook_configured',
    explanation: 'Whether outbound webhooks are configured; the secret is never returned',
  },
];

export type PlatformSettingRow =
  | { key: string; value: unknown; explanation: string }
  | { key: string; configured: boolean; explanation: string };

export type PlatformSettingsView = {
  settings: PlatformSettingRow[];
};

type ServerConfigLike = {
  records_base_path?: string;
  records_base_url?: string;
  webhook_secret?: string;
};

/**
 * SystemSettingsAiAdapter — tenant-scoped projection of platform settings (D-15, D-22).
 * Safety comes from the projection itself: there is no tenant column to filter on.
 */
@Injectable()
export class SystemSettingsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(SystemSettingsAiAdapter.name);
  readonly domain = 'system-settings';

  constructor(
    private readonly systemSettings: SystemSettingsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('SystemSettingsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetPlatformSettings()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Платформенные настройки (проекция тенанта)
- Агент видит только лимиты и возможности своего тенанта: записи, префикс хранения, наличие webhook.
- Сырая таблица system_settings, пути сервера и секреты в ответ не входят. Писать платформенные настройки нельзя.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const config = await this.systemSettings.getServerConfig();
    const view = toPlatformSettingsView(config, vpbxUserUid);
    const recordings = view.settings.find((row) => row.key === 'recordings_available');
    const available = recordings && 'value' in recordings ? recordings.value : false;
    return `Записи: ${available ? 'доступны' : 'недоступны'}`;
  }

  private toolGetPlatformSettings(): AiToolDefinition {
    return {
      name: 'get_platform_settings',
      description:
        'Лимиты и возможности платформы для вызывающего тенанта. Не сырая таблица настроек. Секреты и чужие квоты недоступны. Изменить нельзя.',
      inputSchema: {},
      entityType: 'system_setting',
      handler: async (_args, uid) => {
        const config = await this.systemSettings.getServerConfig();
        return toPlatformSettingsView(config, uid);
      },
    };
  }
}

export function toPlatformSettingsView(
  config: ServerConfigLike,
  vpbxUserUid: number,
): PlatformSettingsView {
  const recordingsAvailable = Boolean(config.records_base_url && String(config.records_base_url).trim());
  const webhookConfigured = isWebhookConfigured(config.webhook_secret);

  const values: Record<PlatformProjectionEntry['key'], PlatformSettingRow> = {
    recordings_available: {
      key: 'recordings_available',
      value: recordingsAvailable,
      explanation: explanationOf('recordings_available'),
    },
    recordings_tenant_prefix: {
      key: 'recordings_tenant_prefix',
      value: `${vpbxUserUid}/`,
      explanation: explanationOf('recordings_tenant_prefix'),
    },
    webhook_configured: {
      key: 'webhook_configured',
      configured: webhookConfigured,
      explanation: explanationOf('webhook_configured'),
    },
  };

  return {
    settings: PLATFORM_TENANT_PROJECTION.map((entry) => values[entry.key]),
  };
}

function explanationOf(key: PlatformProjectionEntry['key']): string {
  return PLATFORM_TENANT_PROJECTION.find((entry) => entry.key === key)?.explanation ?? '';
}

function isWebhookConfigured(secret: unknown): boolean {
  if (typeof secret !== 'string') return false;
  const trimmed = secret.trim();
  if (!trimmed) return false;
  // Masked UI placeholder still means "configured" — never echo it.
  return true;
}
