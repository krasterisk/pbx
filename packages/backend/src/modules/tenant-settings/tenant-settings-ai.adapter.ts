import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { TenantSettingsService } from './tenant-settings.service';
import { TENANT_SETTING_KEYS } from './tenant-settings.keys';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';

export type TenantSettingKind = 'value' | 'presence';

export type TenantSettingAllowEntry = {
  key: string;
  area: string;
  kind: TenantSettingKind;
};

/**
 * Explicit allow list — never project settings by subtracting known secrets (T-15-77).
 * Presence-only entries are secret-valued: configured / not configured, never the value.
 * Only `kind: 'value'` keys may be written by the agent.
 */
export const TENANT_SETTINGS_ALLOW_LIST: readonly TenantSettingAllowEntry[] = [
  { key: 'routes.show_raw_dialplan', area: 'routes', kind: 'value' },
  { key: 'routes.show_flowchart', area: 'routes', kind: 'value' },
  { key: 'integrations.provider_token', area: 'integrations', kind: 'presence' },
];

const WRITABLE_KEYS = new Set(
  TENANT_SETTINGS_ALLOW_LIST.filter((entry) => entry.kind === 'value').map((entry) => entry.key),
);

const FORBIDDEN_IDENTITY_KEYS = new Set([
  'tenant.name',
  'tenant.number',
  'tenant.identity',
  'billing',
  'provisioning',
]);

export type TenantSettingRow =
  | { key: string; value: unknown }
  | { key: string; configured: boolean };

export type TenantSettingsView = {
  areas: Array<{ area: string; settings: TenantSettingRow[] }>;
};

const updateInput = z.strictObject({
  key: z.string().min(1),
  value: z.union([z.boolean(), z.number(), z.string()]),
});

/**
 * TenantSettingsAiAdapter — allowlisted reads and value-only writes.
 * Identity / provisioning / secrets remain forbidden at schema and service levels.
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
    return [this.toolGetTenantSettings(), this.toolUpdateTenantSetting()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Настройки тенанта
- Флаги маршрутов (сырой dialplan, блок-схема) объясняют, почему UI или генерация ведёт себя иначе, чем ожидалось.
- Секретные значения показываются только как configured / not configured.
- Агент может менять только allowlisted value-флаги (не identity, billing, provisioning, secrets).`;
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
        'Настройки тенанта по областям с текущими значениями. Секреты — только configured/not configured.',
      inputSchema: {},
      entityType: 'tenant_setting',
      handler: async (_args, uid) => {
        const stored = await this.tenantSettings.getAll(uid);
        return toTenantSettingsView(stored);
      },
    };
  }

  private toolUpdateTenantSetting(): AiToolDefinition {
    return defineMutationTool({
      name: 'update_tenant_setting',
      description:
        'Изменяет allowlisted value-флаг тенанта (например routes.show_flowchart). Секреты и identity запрещены.',
      entityType: 'tenant_setting',
      schemaVersion: 'tenant-settings-1',
      input: updateInput,
      args: updateInput,
      reload: { kind: 'none' },
      propose: async (input) => {
        assertWritableKey(input.key);
        return {
          entityType: 'tenant_setting',
          entityLabel: input.key,
          summary: [`Установить ${input.key}=${String(input.value)}`],
          before: null,
          after: { key: input.key, value: input.value },
          applyPayload: { tool: 'update_tenant_setting', args: input },
          includesDialplanReload: false,
        };
      },
      revalidate: async (args) => {
        try {
          assertWritableKey(args.key);
          return { ok: true, args };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? String(err) };
        }
      },
      apply: async (args, ctx) => {
        await this.tenantSettings.setMany(ctx.vpbxUserUid, { [args.key]: args.value });
      },
    });
  }
}

export function assertWritableKey(key: string): void {
  if (FORBIDDEN_IDENTITY_KEYS.has(key) || key.startsWith('tenant.') || key.startsWith('billing.')) {
    throw new Error(`TENANT_SETTING_FORBIDDEN:${key}`);
  }
  if (!WRITABLE_KEYS.has(key) || !(key in TENANT_SETTING_KEYS)) {
    throw new Error(`TENANT_SETTING_NOT_ALLOWLISTED:${key}`);
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
