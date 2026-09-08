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
import {
  DELIVERY_BODY_PREVIEW_LENGTH,
  SmsAiAdapter,
  toChannelStatus,
  toDeliveryViews,
} from '../sms/sms-ai.adapter';
import { TelegramAiAdapter } from '../telegram/telegram-ai.adapter';

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

  it('exposes only allowlisted value mutations (not secrets or identity)', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    const mutating = adapter.getTools().filter((tool) => isMutating(tool));
    expect(mutating.map((tool) => tool.name)).toEqual(['update_tenant_setting']);
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
    expect(raw).toMatch(/^---\r?\nname: settings\r?\ndescription: .+/m);
    expect(raw).toMatch(/\nrisk: high\r?\n---/);
    expect(raw).toMatch(/лимит|flag|флаг|маршрут|route/i);
    expect(raw).toMatch(/configured|присутств|наличие|не значен/i);
    expect(raw).toMatch(/allowlist|update_tenant_setting|нельзя.*секрет|identity|billing/i);
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

const SMS_A = {
  id: 'sms-a-1',
  status: 'delivered',
  timestamp: '2026-09-01T10:00:00.000Z',
  body: 'Customer PIN 4455 do not share',
  message: 'Customer PIN 4455 do not share',
  token: 'SMS-TOKEN-A',
};

const SMS_B = {
  id: 'sms-b-9',
  status: 'failed',
  timestamp: '2026-09-02T11:00:00.000Z',
  body: 'Other tenant secret body',
  token: 'SMS-TOKEN-B',
};

const TG_A = {
  id: 'tg-a-1',
  status: 'delivered',
  timestamp: '2026-09-01T12:00:00.000Z',
  text: 'Please call me back at 79001112233',
  body: 'Please call me back at 79001112233',
  bot_token: '123:AA-tenant-a',
  webhook_secret: 'tg-hook-a',
};

const TG_B = {
  id: 'tg-b-2',
  status: 'pending',
  timestamp: '2026-09-02T13:00:00.000Z',
  text: 'Tenant B private note',
  bot_token: '456:BB-tenant-b',
};

function expectNoSendTools(adapter: { getTools: () => Array<{ name: string; proposes?: boolean; destructive?: boolean }> }) {
  expect(adapter.getTools().length).toBeGreaterThan(0);
  for (const tool of adapter.getTools()) {
    expect(tool.name).not.toMatch(/send|resend|dispatch/i);
    expect(isMutating(tool)).toBe(false);
  }
}

describe('read-adapters-settings-messaging — sms (D-12, D-15)', () => {
  let sms: { getChannelStatus: jest.Mock; listDeliveries: jest.Mock; sendSms: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: SmsAiAdapter;

  beforeEach(() => {
    sms = {
      getChannelStatus: jest.fn(async (uid: number) => ({
        configured: uid === TENANT_A,
        enabled: uid === TENANT_A,
        token: uid === TENANT_A ? 'SMS-TOKEN-A' : 'SMS-TOKEN-B',
      })),
      listDeliveries: jest.fn(async (uid: number) => (uid === TENANT_A ? [{ ...SMS_A }] : uid === TENANT_B ? [{ ...SMS_B }] : [])),
      sendSms: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new SmsAiAdapter(sms as any, registry as any);
  });

  it('reports whether the sms channel is configured and enabled without its token', async () => {
    const result = (await getTool(adapter, 'get_sms_channel').handler({}, TENANT_A)) as {
      configured: boolean;
      enabled: boolean;
    };
    expect(result).toEqual({ configured: true, enabled: true });
    expect(JSON.stringify(result)).not.toMatch(/SMS-TOKEN|token|secret/i);
  });

  it('returns recent sms deliveries with status and timestamp for the calling tenant', async () => {
    const result = (await getTool(adapter, 'list_sms_deliveries').handler({}, TENANT_A)) as {
      deliveries: Array<{ id: string; status: string; timestamp: string }>;
    };
    expect(result.deliveries).toEqual([
      expect.objectContaining({
        id: 'sms-a-1',
        status: 'delivered',
        timestamp: '2026-09-01T10:00:00.000Z',
      }),
    ]);
  });

  it('excludes message bodies from delivery results or truncates to the documented preview length', async () => {
    const result = await getTool(adapter, 'list_sms_deliveries').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/PIN 4455|do not share|SMS-TOKEN-A/);
    expect(DELIVERY_BODY_PREVIEW_LENGTH).toBe(0);
    expect(result).not.toEqual(expect.objectContaining({ body: expect.anything() }));
    const views = toDeliveryViews([{ ...SMS_A, body: 'x'.repeat(200) }]);
    expect(JSON.stringify(views)).not.toContain('x'.repeat(20));
    expect(views[0]).not.toHaveProperty('body');
    expect(views[0]).not.toHaveProperty('preview');
  });

  it('declares no tool that sends a message', () => {
    expectNoSendTools(adapter);
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it('returns none of another tenant sms channel state or deliveries', async () => {
    const channel = await getTool(adapter, 'get_sms_channel').handler({}, TENANT_A);
    const deliveries = await getTool(adapter, 'list_sms_deliveries').handler({}, TENANT_A);
    const blob = JSON.stringify(channel) + JSON.stringify(deliveries);
    expect(blob).not.toContain('sms-b-9');
    expect(blob).not.toContain('SMS-TOKEN-B');
    expect(blob).not.toContain('Other tenant');
    expect(sms.getChannelStatus).toHaveBeenCalledWith(TENANT_A);
    expect(sms.listDeliveries).toHaveBeenCalledWith(TENANT_A);
    expect(sms.getChannelStatus).not.toHaveBeenCalledWith(TENANT_B);
    expect(sms.listDeliveries).not.toHaveBeenCalledWith(TENANT_B);

    const other = (await getTool(adapter, 'list_sms_deliveries').handler({}, TENANT_B)) as {
      deliveries: Array<{ id: string }>;
    };
    expect(other.deliveries.map((row) => row.id)).toEqual(['sms-b-9']);
  });
});

describe('read-adapters-settings-messaging — telegram (D-12, D-15)', () => {
  let telegram: { getChannelStatus: jest.Mock; listDeliveries: jest.Mock; sendMessage: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TelegramAiAdapter;

  beforeEach(() => {
    telegram = {
      getChannelStatus: jest.fn(async (uid: number) => ({
        configured: uid === TENANT_A,
        enabled: uid === TENANT_A,
        token: '123:AA-tenant-a',
        webhook_secret: 'tg-hook-a',
      })),
      listDeliveries: jest.fn(async (uid: number) => (uid === TENANT_A ? [{ ...TG_A }] : uid === TENANT_B ? [{ ...TG_B }] : [])),
      sendMessage: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new TelegramAiAdapter(telegram as any, registry as any);
  });

  it('reports whether the telegram channel is configured and enabled without its token or webhook secret', async () => {
    const result = (await getTool(adapter, 'get_telegram_channel').handler({}, TENANT_A)) as {
      configured: boolean;
      enabled: boolean;
    };
    expect(result).toEqual({ configured: true, enabled: true });
    expect(JSON.stringify(result)).not.toMatch(/123:AA|tg-hook|token|webhook/i);
  });

  it('returns recent telegram deliveries with status and timestamp for the calling tenant', async () => {
    const result = (await getTool(adapter, 'list_telegram_deliveries').handler({}, TENANT_A)) as {
      deliveries: Array<{ id: string; status: string; timestamp: string }>;
    };
    expect(result.deliveries[0]).toEqual(
      expect.objectContaining({
        id: 'tg-a-1',
        status: 'delivered',
        timestamp: '2026-09-01T12:00:00.000Z',
      }),
    );
  });

  it('excludes telegram message bodies from delivery results', async () => {
    const result = await getTool(adapter, 'list_telegram_deliveries').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/79001112233|call me back|123:AA|tg-hook-a/i);
  });

  it('declares no tool that sends a telegram message', () => {
    expectNoSendTools(adapter);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('returns none of another tenant telegram channel state or deliveries', async () => {
    const result = await getTool(adapter, 'list_telegram_deliveries').handler({}, TENANT_A);
    expect(JSON.stringify(result)).not.toContain('tg-b-2');
    expect(JSON.stringify(result)).not.toContain('Tenant B');
    expect(telegram.listDeliveries).toHaveBeenCalledWith(TENANT_A);
    expect(telegram.listDeliveries).not.toHaveBeenCalledWith(TENANT_B);
  });

  it('asserts channel status shape never includes credentials', () => {
    expect(toChannelStatus({ configured: true, enabled: false, token: 'leak', webhook_secret: 'hook' })).toEqual({
      configured: true,
      enabled: false,
    });
  });

  it('ships a messaging skill covering both channels, delivery status, hidden bodies and no send', () => {
    const skillPath = path.join(__dirname, '../../skills/messaging/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: messaging\r?\ndescription: .+/m);
    expect(raw).toMatch(/\nrisk: medium\r?\n---/);
    expect(raw).toMatch(/sms|SMS/i);
    expect(raw).toMatch(/telegram|Telegram/i);
    expect(raw).toMatch(/delivered|доставле|failed|ошиб/i);
    expect(raw).toMatch(/тел|body|текст/i);
    expect(raw).toMatch(/не отправ|cannot send|нельзя отправ|resend/i);
  });
});


