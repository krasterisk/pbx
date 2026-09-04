import * as fs from 'fs';
import * as path from 'path';
import {
  TENANT_SETTINGS_ALLOW_LIST,
  TenantSettingsAiAdapter,
  toTenantSettingsView,
} from '../tenant-settings/tenant-settings-ai.adapter';
import {
  PLATFORM_TENANT_PROJECTION,
  SystemSettingsAiAdapter,
  toPlatformSettingsView,
} from '../system-settings/system-settings-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

function getTool(adapter: { getTools: () => Array<{ name: string }> }, name: string) {
  const tool = adapter.getTools().find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool as {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    entityType: string;
    proposes?: boolean;
    destructive?: boolean;
    handler: (args: Record<string, unknown>, uid: number) => Promise<unknown>;
  };
}

function isMutating(tool: { name: string; proposes?: boolean; destructive?: boolean }): boolean {
  return Boolean(tool.proposes || tool.destructive);
}

const SETTINGS_A: Record<string, unknown> = {
  'routes.show_raw_dialplan': true,
  'routes.show_flowchart': false,
  'integrations.provider_token': 'sk-live-tenant-a-should-never-leak',
  sms_beeline_token: 'SMS-TOKEN-A',
  encrypted_blob: 'iv:tag:ciphertext',
};

const SETTINGS_B: Record<string, unknown> = {
  'routes.show_raw_dialplan': false,
  'routes.show_flowchart': true,
  'integrations.provider_token': 'sk-live-tenant-b-other',
  sms_beeline_token: 'SMS-TOKEN-B',
};

describe('read-adapters-settings-messaging — tenant settings (D-15, secret boundary)', () => {
  let tenantSettings: { getAll: jest.Mock; setMany: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TenantSettingsAiAdapter;

  beforeEach(() => {
    tenantSettings = {
      getAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return { ...SETTINGS_A };
        if (uid === TENANT_B) return { ...SETTINGS_B };
        return {};
      }),
      setMany: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new TenantSettingsAiAdapter(tenantSettings as any, registry as any);
  });

  it('returns the tenant settings grouped by area with their current values', async () => {
    const result = (await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_A)) as {
      areas: Array<{ area: string; settings: Array<{ key: string; value?: unknown }> }>;
    };
    const routes = result.areas.find((group) => group.area === 'routes');
    expect(routes).toBeDefined();
    expect(routes!.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'routes.show_raw_dialplan', value: true }),
        expect.objectContaining({ key: 'routes.show_flowchart', value: false }),
      ]),
    );
  });

  it('builds output from an explicit allow list and never returns encrypted, token or secret values', async () => {
    const result = await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/sk-live-tenant-a|SMS-TOKEN-A|iv:tag:ciphertext|sms_beeline_token|encrypted_blob/i);
    const keys = resultKeys(result);
    const allowed = TENANT_SETTINGS_ALLOW_LIST.map((entry) => entry.key).sort();
    expect(keys.sort()).toEqual(allowed);
  });

  it('reports a secret-valued setting as configured or not configured, never by value', async () => {
    const result = (await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_A)) as {
      areas: Array<{ settings: Array<{ key: string; configured?: boolean; value?: unknown }> }>;
    };
    const secret = result.areas.flatMap((group) => group.settings).find((row) => row.key === 'integrations.provider_token');
    expect(secret).toEqual({ key: 'integrations.provider_token', configured: true });
    expect(secret).not.toHaveProperty('value');

    tenantSettings.getAll.mockResolvedValueOnce({
      'routes.show_raw_dialplan': true,
      'routes.show_flowchart': true,
    });
    const empty = (await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_A)) as {
      areas: Array<{ settings: Array<{ key: string; configured?: boolean }> }>;
    };
    const absent = empty.areas.flatMap((group) => group.settings).find((row) => row.key === 'integrations.provider_token');
    expect(absent).toEqual({ key: 'integrations.provider_token', configured: false });
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
    }
    expect(tenantSettings.setMany).not.toHaveBeenCalled();
  });

  it('returns none of another tenant settings', async () => {
    const result = await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('routes.show_raw_dialplan');
    expect(blob).not.toContain('sk-live-tenant-b');
    expect(blob).not.toContain('SMS-TOKEN-B');
    expect(tenantSettings.getAll).toHaveBeenCalledWith(TENANT_A);
    expect(tenantSettings.getAll).not.toHaveBeenCalledWith(TENANT_B);

    const other = await getTool(adapter, 'get_tenant_settings').handler({}, TENANT_B);
    const routesB = (other as { areas: Array<{ area: string; settings: Array<{ key: string; value?: unknown }> }> })
      .areas.find((group) => group.area === 'routes');
    expect(routesB!.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'routes.show_raw_dialplan', value: false }),
      ]),
    );
  });

  it('asserts secret absence against the declared output shape, not only fixtures', () => {
    for (const entry of TENANT_SETTINGS_ALLOW_LIST) {
      if (entry.kind === 'presence') {
        expect(entry.key).toMatch(/token|secret|password|credential|key/i);
      } else {
        expect(entry.key).not.toMatch(/token|secret|password|encrypted|credential/i);
      }
    }
    const fat = {
      'routes.show_raw_dialplan': false,
      'routes.show_flowchart': true,
      'integrations.provider_token': 'sk-fat',
      webhook_secret: 'whsec',
      encrypted_api_key: 'enc',
    };
    const view = toTenantSettingsView(fat);
    const blob = JSON.stringify(view);
    expect(blob).not.toMatch(/sk-fat|whsec|enc|webhook_secret|encrypted_api_key/i);
    expect(view.areas.flatMap((group) => group.settings).map((row) => row.key).sort()).toEqual(
      TENANT_SETTINGS_ALLOW_LIST.map((entry) => entry.key).sort(),
    );
  });

  it('ships a settings skill covering diagnosis, presence-only secrets and the read-only boundary', () => {
    const skillPath = path.join(__dirname, '../../skills/settings/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: settings\r?\ndescription: .+\r?\n---/);
    expect(raw).toMatch(/лимит|flag|флаг|маршрут|route/i);
    expect(raw).toMatch(/configured|присутств|наличие|не значен/i);
    expect(raw).toMatch(/не меня|cannot change|нельзя измен|settings screen|экран настро/i);
  });
});

function resultKeys(result: unknown): string[] {
  const areas = (result as { areas?: Array<{ settings?: Array<{ key: string }> }> }).areas ?? [];
  return areas.flatMap((group) => (group.settings ?? []).map((row) => row.key));
}

const SERVER_CONFIG_A = {
  records_base_path: '/usr/records',
  records_base_url: 'https://records.example.test',
  webhook_secret: '••••••••',
};

const SERVER_CONFIG_B = {
  records_base_path: '/usr/records',
  records_base_url: '',
  webhook_secret: '',
};

const RAW_PLATFORM_ROWS = [
  { key: 'records_base_path', value: '/usr/records' },
  { key: 'records_base_url', value: 'https://records.example.test' },
  { key: 'webhook_secret', value: 'whsec-live-should-never-leak' },
  { key: 'smtp_password', value: 'smtp-secret' },
  { key: 'new_platform_flag', value: 'next-year' },
];

describe('read-adapters-settings-messaging — platform settings projection (D-15, D-22)', () => {
  let systemSettings: {
    getServerConfig: jest.Mock;
    getServerConfigRaw: jest.Mock;
    findAll: jest.Mock;
    updateServerConfig: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: SystemSettingsAiAdapter;

  beforeEach(() => {
    systemSettings = {
      getServerConfig: jest.fn(async () => ({ ...SERVER_CONFIG_A })),
      getServerConfigRaw: jest.fn(async () => ({
        records_base_path: '/usr/records',
        records_base_url: 'https://records.example.test',
        webhook_secret: 'whsec-live-should-never-leak',
      })),
      findAll: jest.fn(async () => RAW_PLATFORM_ROWS.map((row) => ({ ...row }))),
      updateServerConfig: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new SystemSettingsAiAdapter(systemSettings as any, registry as any);
  });

  it('returns only the platform settings that describe the calling tenant limits and capabilities', async () => {
    const result = (await getTool(adapter, 'get_platform_settings').handler({}, TENANT_A)) as {
      settings: Array<{ key: string; value?: unknown; configured?: boolean }>;
    };
    const keys = result.settings.map((row) => row.key).sort();
    expect(keys).toEqual([...PLATFORM_TENANT_PROJECTION.map((entry) => entry.key)].sort());
    expect(result.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'recordings_available', value: true }),
        expect.objectContaining({ key: 'recordings_tenant_prefix', value: `${TENANT_A}/` }),
        expect.objectContaining({ key: 'webhook_configured', configured: true }),
      ]),
    );
  });

  it('omits platform-wide operational values, provider configuration and other tenants allocations', async () => {
    const result = await getTool(adapter, 'get_platform_settings').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/\/usr\/records|records\.example\.test|whsec-live|smtp-secret|new_platform_flag|••••/i);
    expect(systemSettings.getServerConfigRaw).not.toHaveBeenCalled();
    expect(systemSettings.findAll).not.toHaveBeenCalled();
  });

  it('returns each tenant its own projection', async () => {
    const a = (await getTool(adapter, 'get_platform_settings').handler({}, TENANT_A)) as {
      settings: Array<{ key: string; value?: unknown; configured?: boolean }>;
    };
    systemSettings.getServerConfig.mockResolvedValueOnce({ ...SERVER_CONFIG_B });
    const b = (await getTool(adapter, 'get_platform_settings').handler({}, TENANT_B)) as {
      settings: Array<{ key: string; value?: unknown; configured?: boolean }>;
    };

    const prefixA = a.settings.find((row) => row.key === 'recordings_tenant_prefix');
    const prefixB = b.settings.find((row) => row.key === 'recordings_tenant_prefix');
    expect(prefixA?.value).toBe(`${TENANT_A}/`);
    expect(prefixB?.value).toBe(`${TENANT_B}/`);
    expect(prefixA?.value).not.toBe(prefixB?.value);

    expect(a.settings.find((row) => row.key === 'recordings_available')?.value).toBe(true);
    expect(b.settings.find((row) => row.key === 'recordings_available')?.value).toBe(false);
    expect(a.settings.find((row) => row.key === 'webhook_configured')?.configured).toBe(true);
    expect(b.settings.find((row) => row.key === 'webhook_configured')?.configured).toBe(false);
    expect(JSON.stringify(a)).not.toContain(`${TENANT_B}/`);
    expect(JSON.stringify(b)).not.toContain(`${TENANT_A}/`);
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
    }
    expect(systemSettings.updateServerConfig).not.toHaveBeenCalled();
  });

  it('does not include a platform setting absent from the explicit projection', () => {
    const extra = {
      records_base_path: '/var/spool',
      records_base_url: 'https://cdn.example',
      webhook_secret: '••••••••',
      smtp_password: 'new-secret',
      brand_new_quota: 99,
    };
    const view = toPlatformSettingsView(extra, TENANT_A);
    const keys = view.settings.map((row) => row.key).sort();
    expect(keys).toEqual([...PLATFORM_TENANT_PROJECTION.map((entry) => entry.key)].sort());
    expect(JSON.stringify(view)).not.toMatch(/smtp_password|brand_new_quota|new-secret|\/var\/spool|cdn\.example|••••/i);
    for (const entry of PLATFORM_TENANT_PROJECTION) {
      expect(entry.explanation.length).toBeGreaterThan(0);
    }
  });
});

