import * as fs from 'fs';
import * as path from 'path';
import {
  TENANT_SETTINGS_ALLOW_LIST,
  TenantSettingsAiAdapter,
  toTenantSettingsView,
} from '../tenant-settings/tenant-settings-ai.adapter';

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
