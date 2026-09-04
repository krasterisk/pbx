import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

export type TenantSettingKind = 'value' | 'presence';

export type TenantSettingAllowEntry = {
  key: string;
  area: string;
  kind: TenantSettingKind;
};

/**
 * Explicit allow list — never project settings by subtracting known secrets (T-15-77).
 * Presence-only entries are secret-valued: configured / not configured, never the value.
 */
export const TENANT_SETTINGS_ALLOW_LIST: readonly TenantSettingAllowEntry[] = [
  { key: 'routes.show_raw_dialplan', area: 'routes', kind: 'value' },
  { key: 'routes.show_flowchart', area: 'routes', kind: 'value' },
  { key: 'integrations.provider_token', area: 'integrations', kind: 'presence' },
];

export type TenantSettingRow =
  | { key: string; value: unknown }
  | { key: string; configured: boolean };

export type TenantSettingsView = {
  areas: Array<{ area: string; settings: TenantSettingRow[] }>;
};

/**
 * TenantSettingsAiAdapter — read-only tenant settings (D-15).
 * Writing tenant settings through the agent is out of this phase's scope.
 */
@Injectable()
export class TenantSettingsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TenantSettingsAiAdapter.name);
  readonly domain = 'tenant-settings';

  constructor(
    private readonly tenantSettings: TenantSettingsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TenantSettingsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetTenantSettings()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Настройки тенанта
- Флаги маршрутов (сырой dialplan, блок-схема) объясняют, почему UI или генерация ведёт себя иначе, чем ожидалось.
- Секретные значения показываются только как configured / not configured. Агент настройки не меняет.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const view = toTenantSettingsView(await this.tenantSettings.getAll(vpbxUserUid));
    if (view.areas.length === 0) return '';
    const flags = view.areas
      .flatMap((group) => group.settings)
      .filter((row): row is { key: string; value: unknown } => 'value' in row)
      .map((row) => `${row.key}=${String(row.value)}`);
    return flags.length ? `Настройки: ${flags.join(', ')}` : '';
  }

  private toolGetTenantSettings(): AiToolDefinition {
    return {
      name: 'get_tenant_settings',
      description:
        'Настройки тенанта по областям с текущими значениями. Секреты — только configured/not configured. Изменить настройки нельзя.',
      inputSchema: {},
      entityType: 'tenant_setting',
      handler: async (_args, uid) => {
        const stored = await this.tenantSettings.getAll(uid);
        return toTenantSettingsView(stored);
      },
    };
  }
}

export function toTenantSettingsView(stored: Record<string, unknown>): TenantSettingsView {
  const byArea = new Map<string, TenantSettingRow[]>();
  for (const entry of TENANT_SETTINGS_ALLOW_LIST) {
    const rows = byArea.get(entry.area) ?? [];
    if (entry.kind === 'presence') {
      const raw = stored[entry.key];
      rows.push({ key: entry.key, configured: isConfigured(raw) });
    } else {
      rows.push({ key: entry.key, value: stored[entry.key] });
    }
    byArea.set(entry.area, rows);
  }
  return {
    areas: [...byArea.entries()].map(([area, settings]) => ({ area, settings })),
  };
}

function isConfigured(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
