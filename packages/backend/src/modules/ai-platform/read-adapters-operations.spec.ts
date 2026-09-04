import * as fs from 'fs';
import * as path from 'path';
import { TENANT_ARG_KEYS } from './ai-adapter.types';
import {
  OPERATIONS_PREVIEW_LENGTH,
  OPERATIONS_RESULT_CEILING,
  NotificationsAiAdapter,
  toNotificationViews,
} from '../notifications/notifications-ai.adapter';
import { PromptsAiAdapter } from '../prompts/prompts-ai.adapter';
import { ServiceRequestsAiAdapter } from '../service-requests/service-requests-ai.adapter';
import { KomandorClaimsAiAdapter } from '../komandor-claims/komandor-claims-ai.adapter';

export const SHARED_OPERATIONS_SKILL_DOMAINS = [
  'notifications',
  'prompts',
  'service-requests',
  'komandor-claims',
] as const;

const TENANT_A = 100;
const TENANT_B = 200;

const NOTE_A = {
  uid: 1,
  kind: 'telegram',
  status: 'sent',
  timestamp: '2026-09-01T10:00:00.000Z',
  body: 'Tenant A PIN 4455 do not share this body in full',
};

const NOTE_B = {
  uid: 9,
  kind: 'email',
  status: 'failed',
  timestamp: '2026-09-02T11:00:00.000Z',
  body: 'Tenant B private notification body',
};

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

describe('read-adapters-operations — notifications (D-12, D-15)', () => {
  let notifications: { findAll: jest.Mock; create: jest.Mock; dispatch: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: NotificationsAiAdapter;

  beforeEach(() => {
    notifications = {
      findAll: jest.fn(async (uid: number) => (uid === TENANT_A ? [{ ...NOTE_A }] : uid === TENANT_B ? [{ ...NOTE_B }] : [])),
      create: jest.fn(),
      dispatch: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new NotificationsAiAdapter(notifications as any, registry as any);
  });

  it('returns the tenant recent notifications with kind, status and timestamp', async () => {
    const result = (await getTool(adapter, 'list_notifications').handler({}, TENANT_A)) as {
      notifications: Array<{ kind: string; status: string; timestamp: string }>;
    };
    expect(result.notifications).toEqual([
      expect.objectContaining({
        kind: 'telegram',
        status: 'sent',
        timestamp: '2026-09-01T10:00:00.000Z',
      }),
    ]);
  });

  it('clamps a requested result count above the documented ceiling', async () => {
    const fat = Array.from({ length: OPERATIONS_RESULT_CEILING + 15 }, (_, index) => ({
      ...NOTE_A,
      uid: index + 1,
      timestamp: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));
    notifications.findAll.mockResolvedValueOnce(fat);

    const result = (await getTool(adapter, 'list_notifications').handler(
      { limit: OPERATIONS_RESULT_CEILING + 80 },
      TENANT_A,
    )) as { notifications: unknown[] };

    expect(OPERATIONS_RESULT_CEILING).toBe(20);
    expect(result.notifications).toHaveLength(OPERATIONS_RESULT_CEILING);
    expect(fat.length).toBeGreaterThan(OPERATIONS_RESULT_CEILING);
  });

  it('truncates notification bodies to the documented preview length', async () => {
    const longBody = `PREFIX-SECRET-${'x'.repeat(OPERATIONS_PREVIEW_LENGTH + 40)}`;
    notifications.findAll.mockResolvedValueOnce([{ ...NOTE_A, body: longBody }]);

    const result = (await getTool(adapter, 'list_notifications').handler({}, TENANT_A)) as {
      notifications: Array<{ preview?: string; body?: string }>;
    };
    const blob = JSON.stringify(result);

    expect(OPERATIONS_PREVIEW_LENGTH).toBe(120);
    expect(result.notifications[0].preview).toHaveLength(OPERATIONS_PREVIEW_LENGTH);
    expect(result.notifications[0]).not.toHaveProperty('body');
    expect(blob).not.toContain(longBody);
    expect(blob).not.toContain('x'.repeat(OPERATIONS_PREVIEW_LENGTH + 1));

    const views = toNotificationViews([{ ...NOTE_A, body: longBody }], {});
    expect(views[0].preview).toHaveLength(OPERATIONS_PREVIEW_LENGTH);
    expect(views[0]).not.toHaveProperty('body');
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(tool.name).not.toMatch(/send|create|dispatch|update|delete/i);
      expect(isMutating(tool)).toBe(false);
    }
    expect(notifications.create).not.toHaveBeenCalled();
    expect(notifications.dispatch).not.toHaveBeenCalled();
  });

  it('returns none of another tenant notifications', async () => {
    const result = await getTool(adapter, 'list_notifications').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('telegram');
    expect(blob).not.toContain('Tenant B');
    expect(blob).not.toContain('email');
    expect(notifications.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(notifications.findAll).not.toHaveBeenCalledWith(TENANT_B);

    const other = (await getTool(adapter, 'list_notifications').handler({}, TENANT_B)) as {
      notifications: Array<{ kind: string }>;
    };
    expect(other.notifications.map((row) => row.kind)).toEqual(['email']);
  });
});

const PROMPT_A = {
  uid: 3,
  filename: 'prompt_100_welcome',
  comment: 'Welcome greeting',
  description: 'IVR welcome',
  durationSeconds: 8,
  duration: 8,
  user_uid: TENANT_A,
  source_type: 'file',
  tts: null,
  filePath: '/usr/records/100/sounds/prompt_100_welcome.wav',
  audio: Buffer.from('RIFF-AUDIO-BYTES-SHOULD-NEVER-LEAK'),
};

const PROMPT_B = {
  uid: 30,
  filename: 'prompt_200_secret',
  comment: 'Tenant B greeting',
  description: 'Other tenant',
  durationSeconds: 4,
  user_uid: TENANT_B,
  source_type: 'tts',
  tts: { text: 'Tenant B private TTS script', engine_uid: 9 },
  filePath: '/usr/records/200/sounds/prompt_200_secret.wav',
};

const IVR_A = {
  uid: 7,
  name: 'main-menu',
  prompts: [{ kind: 'audio', filename: 'prompt_100_welcome.wav' }],
};

const IVR_B = {
  uid: 70,
  name: 'other-menu',
  prompts: [{ kind: 'audio', filename: 'prompt_200_secret.wav' }],
};

const REQUEST_A = {
  uid: 11,
  request_number: 'SR-A-11',
  request_status: 'in_progress',
  call_received_at: '2026-09-01T09:00:00.000Z',
  created_at: '2026-09-01T09:00:00.000Z',
  topic: 'Heat',
  comment: `Boiler leak details that must be truncated ${'y'.repeat(OPERATIONS_PREVIEW_LENGTH)}`,
  phone: '79001112233',
  address: 'Tenant A secret street 1',
  production_comment: 'Internal production note A',
};

const REQUEST_B = {
  uid: 22,
  request_number: 'SR-B-22',
  request_status: 'new',
  call_received_at: '2026-09-02T09:00:00.000Z',
  created_at: '2026-09-02T09:00:00.000Z',
  topic: 'Water',
  comment: 'Tenant B request correspondence',
  phone: '79009998877',
};

const CLAIM_A = {
  uid: 41,
  request_number: 'CL-A-41',
  request_status: 'new',
  request_date: '2026-09-01T12:00:00.000Z',
  created_at: '2026-09-01T12:00:00.000Z',
  topic: 'Quality',
  description: `Customer wrote a long claim ${'z'.repeat(OPERATIONS_PREVIEW_LENGTH)}`,
  contact_info: 'call me at 79001112233',
  client_phone: '79001112233',
  extra_emails: 'a-secret@example.test',
};

const CLAIM_B = {
  uid: 42,
  request_number: 'CL-B-42',
  request_status: 'completed',
  request_date: '2026-09-03T12:00:00.000Z',
  created_at: '2026-09-03T12:00:00.000Z',
  topic: 'Refund',
  description: 'Tenant B claim correspondence',
  client_phone: '79005554433',
};

const MEDIA_LEAK = /\.wav|\/usr\/|audio\/|base64|filePath|sounds\/|RIFF-AUDIO|private TTS/i;

describe('read-adapters-operations — audio prompts (D-15, media boundary)', () => {
  let prompts: { findAll: jest.Mock; create: jest.Mock; savePromptAudio: jest.Mock };
  let ivrs: { findAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: PromptsAiAdapter;

  beforeEach(() => {
    prompts = {
      findAll: jest.fn(async (uid: number) => (uid === TENANT_A ? [{ ...PROMPT_A }] : uid === TENANT_B ? [{ ...PROMPT_B }] : [])),
      create: jest.fn(),
      savePromptAudio: jest.fn(),
    };
    ivrs = {
      findAll: jest.fn(async (uid: number) => (uid === TENANT_A ? [{ ...IVR_A }] : uid === TENANT_B ? [{ ...IVR_B }] : [])),
    };
    registry = { register: jest.fn() };
    adapter = new PromptsAiAdapter(prompts as any, registry as any, ivrs as any);
  });

  it('lists the tenant audio prompts with name, duration and referencing entities', async () => {
    const result = (await getTool(adapter, 'list_audio_prompts').handler({}, TENANT_A)) as {
      prompts: Array<{ name: string; durationSeconds?: number; referencedBy?: Array<{ entityType: string; name: string }> }>;
    };
    expect(result.prompts).toEqual([
      expect.objectContaining({
        name: 'Welcome greeting',
        durationSeconds: 8,
        referencedBy: [expect.objectContaining({ entityType: 'ivr', name: 'main-menu' })],
      }),
    ]);
  });

  it('returns no audio content and no fetchable path', async () => {
    const result = await getTool(adapter, 'list_audio_prompts').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(MEDIA_LEAK);
    expect(result).not.toEqual(expect.objectContaining({ filePath: expect.anything() }));
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(tool.name).not.toMatch(/create|upload|delete|update|synthesize/i);
      expect(isMutating(tool)).toBe(false);
    }
    expect(prompts.create).not.toHaveBeenCalled();
    expect(prompts.savePromptAudio).not.toHaveBeenCalled();
  });

  it('returns none of another tenant prompts', async () => {
    const result = await getTool(adapter, 'list_audio_prompts').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('Welcome greeting');
    expect(blob).not.toContain('Tenant B greeting');
    expect(blob).not.toContain('other-menu');
    expect(prompts.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(ivrs.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(prompts.findAll).not.toHaveBeenCalledWith(TENANT_B);

    const other = (await getTool(adapter, 'list_audio_prompts').handler({}, TENANT_B)) as {
      prompts: Array<{ name: string }>;
    };
    expect(other.prompts.map((row) => row.name)).toEqual(['Tenant B greeting']);
  });
});

describe('read-adapters-operations — service requests (D-15, content boundary)', () => {
  let serviceRequests: { findAll: jest.Mock; create: jest.Mock; update: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: ServiceRequestsAiAdapter;

  beforeEach(() => {
    serviceRequests = {
      findAll: jest.fn(async (uid: number) => ({
        rows: uid === TENANT_A ? [{ ...REQUEST_A }] : uid === TENANT_B ? [{ ...REQUEST_B }] : [],
        count: 1,
      })),
      create: jest.fn(),
      update: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new ServiceRequestsAiAdapter(serviceRequests as any, registry as any);
  });

  it('lists requests with status, timestamps and a truncated subject using shared bounds', async () => {
    const result = (await getTool(adapter, 'list_service_requests').handler(
      { limit: OPERATIONS_RESULT_CEILING + 40 },
      TENANT_A,
    )) as {
      requests: Array<{ status: string; timestamp: string; subject: string }>;
    };
    expect(serviceRequests.findAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ limit: OPERATIONS_RESULT_CEILING }),
    );
    expect(result.requests[0]).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        timestamp: '2026-09-01T09:00:00.000Z',
      }),
    );
    expect(result.requests[0].subject.length).toBeLessThanOrEqual(OPERATIONS_PREVIEW_LENGTH);
    expect(JSON.stringify(result)).not.toContain('y'.repeat(OPERATIONS_PREVIEW_LENGTH));
    expect(JSON.stringify(result)).not.toMatch(/79001112233|secret street|Internal production/);
  });

  it('declares no mutating tool', () => {
    for (const tool of adapter.getTools()) {
      expect(tool.name).not.toMatch(/create|update|delete|send/i);
      expect(isMutating(tool)).toBe(false);
    }
    expect(serviceRequests.create).not.toHaveBeenCalled();
    expect(serviceRequests.update).not.toHaveBeenCalled();
  });

  it('returns none of another tenant requests', async () => {
    const result = await getTool(adapter, 'list_service_requests').handler({}, TENANT_A);
    expect(JSON.stringify(result)).not.toContain('SR-B-22');
    expect(JSON.stringify(result)).not.toContain('Tenant B request');
    expect(serviceRequests.findAll).toHaveBeenCalledWith(TENANT_A, expect.any(Object));
    expect(serviceRequests.findAll).not.toHaveBeenCalledWith(TENANT_B, expect.anything());

    const other = (await getTool(adapter, 'list_service_requests').handler({}, TENANT_B)) as {
      requests: Array<{ id?: string }>;
    };
    expect(JSON.stringify(other)).toContain('SR-B-22');
  });
});

describe('read-adapters-operations — claims (D-15, content boundary)', () => {
  let claims: { findAll: jest.Mock; create: jest.Mock; update: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: KomandorClaimsAiAdapter;

  beforeEach(() => {
    claims = {
      findAll: jest.fn(async (uid: number) => ({
        rows: uid === TENANT_A ? [{ ...CLAIM_A }] : uid === TENANT_B ? [{ ...CLAIM_B }] : [],
        count: 1,
      })),
      create: jest.fn(),
      update: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new KomandorClaimsAiAdapter(claims as any, registry as any);
  });

  it('lists claims with status, timestamps and a truncated subject using shared bounds', async () => {
    const fat = Array.from({ length: OPERATIONS_RESULT_CEILING + 8 }, (_, index) => ({
      ...CLAIM_A,
      uid: index + 1,
      request_number: `CL-A-${index + 1}`,
    }));
    claims.findAll.mockResolvedValueOnce({ rows: fat, count: fat.length });

    const result = (await getTool(adapter, 'list_claims').handler(
      { limit: OPERATIONS_RESULT_CEILING + 50 },
      TENANT_A,
    )) as { claims: Array<{ status: string; timestamp: string; subject: string }> };

    expect(claims.findAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ limit: OPERATIONS_RESULT_CEILING }),
    );
    expect(result.claims).toHaveLength(OPERATIONS_RESULT_CEILING);
    expect(result.claims[0]).toEqual(
      expect.objectContaining({
        status: 'new',
        timestamp: '2026-09-01T12:00:00.000Z',
      }),
    );
    expect(result.claims[0].subject.length).toBeLessThanOrEqual(OPERATIONS_PREVIEW_LENGTH);
    expect(JSON.stringify(result)).not.toContain('z'.repeat(OPERATIONS_PREVIEW_LENGTH));
    expect(JSON.stringify(result)).not.toMatch(/79001112233|a-secret@example/);
  });

  it('declares no mutating tool', () => {
    for (const tool of adapter.getTools()) {
      expect(tool.name).not.toMatch(/create|update|delete|send/i);
      expect(isMutating(tool)).toBe(false);
    }
    expect(claims.create).not.toHaveBeenCalled();
    expect(claims.update).not.toHaveBeenCalled();
  });

  it('returns none of another tenant claims', async () => {
    const result = await getTool(adapter, 'list_claims').handler({}, TENANT_A);
    expect(JSON.stringify(result)).not.toContain('CL-B-42');
    expect(JSON.stringify(result)).not.toContain('Tenant B claim');
    expect(claims.findAll).toHaveBeenCalledWith(TENANT_A, expect.any(Object));
    expect(claims.findAll).not.toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});

describe('read-adapters-operations — shared skill (D-12, D-16)', () => {
  it('ships one operations skill covering all four domains, preview and the read-only boundary', () => {
    const skillPath = path.join(__dirname, '../../skills/operations/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: operations\r?\ndescription: .+\r?\n---/);
    for (const domain of SHARED_OPERATIONS_SKILL_DOMAINS) {
      expect(raw).toContain(domain);
    }
    expect(raw).toMatch(/превью|preview/i);
    expect(raw).toMatch(/статус/i);
    expect(raw).toMatch(/не отправ|не созда|не меня|cannot create|cannot send/i);
    expect(raw).toMatch(/15-23|shared-skill|общий файл/i);
  });
});

describe('read-adapters-operations — per-tool and registry-enumerated isolation (D-22)', () => {
  let notificationsAdapter: NotificationsAiAdapter;
  let promptsAdapter: PromptsAiAdapter;
  let requestsAdapter: ServiceRequestsAiAdapter;
  let claimsAdapter: KomandorClaimsAiAdapter;

  beforeEach(() => {
    const registry = { register: jest.fn() };
    notificationsAdapter = new NotificationsAiAdapter(
      {
        findAll: jest.fn(async (uid: number) =>
          uid === TENANT_A ? [{ ...NOTE_A }] : uid === TENANT_B ? [{ ...NOTE_B }] : [],
        ),
      } as any,
      registry as any,
    );
    promptsAdapter = new PromptsAiAdapter(
      {
        findAll: jest.fn(async (uid: number) =>
          uid === TENANT_A ? [{ ...PROMPT_A }] : uid === TENANT_B ? [{ ...PROMPT_B }] : [],
        ),
      } as any,
      registry as any,
      {
        findAll: jest.fn(async (uid: number) =>
          uid === TENANT_A ? [{ ...IVR_A }] : uid === TENANT_B ? [{ ...IVR_B }] : [],
        ),
      } as any,
    );
    requestsAdapter = new ServiceRequestsAiAdapter(
      {
        findAll: jest.fn(async (uid: number) => ({
          rows: uid === TENANT_A ? [{ ...REQUEST_A }] : uid === TENANT_B ? [{ ...REQUEST_B }] : [],
          count: 1,
        })),
      } as any,
      registry as any,
    );
    claimsAdapter = new KomandorClaimsAiAdapter(
      {
        findAll: jest.fn(async (uid: number) => ({
          rows: uid === TENANT_A ? [{ ...CLAIM_A }] : uid === TENANT_B ? [{ ...CLAIM_B }] : [],
          count: 1,
        })),
      } as any,
      registry as any,
    );
  });

  it('proves per-tool cross-tenant isolation and forged-key ignore for every operations adapter tool', async () => {
    const tools = [
      ...notificationsAdapter.getTools(),
      ...promptsAdapter.getTools(),
      ...requestsAdapter.getTools(),
      ...claimsAdapter.getTools(),
    ];
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      ['list_audio_prompts', 'list_claims', 'list_notifications', 'list_service_requests'].sort(),
    );

    const foreignA = [
      'Tenant B',
      'other-menu',
      'SR-B-22',
      'CL-B-42',
      'Tenant B greeting',
      'Tenant B private',
      'Tenant B request',
      'Tenant B claim',
    ];
    const foreignB = [
      'PIN 4455',
      'main-menu',
      'Welcome greeting',
      'SR-A-11',
      'CL-A-41',
      'secret street',
    ];

    for (const tool of tools) {
      const forged = { limit: 10 } as Record<string, unknown>;
      for (const key of TENANT_ARG_KEYS) {
        forged[key] = TENANT_B;
      }

      const resultA = await tool.handler({ limit: 10 }, TENANT_A);
      const forgedResult = await tool.handler(forged, TENANT_A);
      const resultB = await tool.handler({ limit: 10 }, TENANT_B);

      const blobA = JSON.stringify(resultA);
      const blobB = JSON.stringify(resultB);
      try {
        expect(JSON.stringify(forgedResult)).toEqual(blobA);
        for (const token of foreignA) {
          expect(blobA).not.toContain(token);
        }
        for (const token of foreignB) {
          expect(blobB).not.toContain(token);
        }
        expect(blobA).not.toEqual(blobB);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`${tool.name}: ${message}`);
      }
    }
  });
});


