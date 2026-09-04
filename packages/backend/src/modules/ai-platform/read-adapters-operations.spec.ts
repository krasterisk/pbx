import {
  OPERATIONS_PREVIEW_LENGTH,
  OPERATIONS_RESULT_CEILING,
  NotificationsAiAdapter,
  toNotificationViews,
} from '../notifications/notifications-ai.adapter';

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
