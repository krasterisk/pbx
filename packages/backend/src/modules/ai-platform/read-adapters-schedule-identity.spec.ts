import * as fs from 'fs';
import * as path from 'path';
import { TimeGroupsAiAdapter } from '../time-groups/time-groups-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const OFFICE_HOURS = {
  time_start: '09:00',
  time_end: '18:00',
  days_of_week: 'mon-fri',
  days_of_month: '*',
  months: '*',
};

const SCHEDULE_A = {
  uid: 11,
  name: 'office-hours',
  comment: 'Weekday office',
  intervals: [OFFICE_HOURS],
  user_uid: TENANT_A,
};

const SCHEDULE_B = {
  uid: 22,
  name: 'night-shift',
  comment: 'Tenant B nights',
  intervals: [
    {
      time_start: '22:00',
      time_end: '06:00',
      days_of_week: '*',
      days_of_month: '*',
      months: '*',
    },
  ],
  user_uid: TENANT_B,
};

/** Wednesday 2026-09-02 12:00 in Europe/Moscow (UTC+3) = 09:00Z */
const MOSCOW_WED_NOON = '2026-09-02T09:00:00.000Z';
/** Wednesday 2026-09-02 19:10 in Europe/Moscow = 16:10Z */
const MOSCOW_WED_EVENING = '2026-09-02T16:10:00.000Z';

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

describe('read-adapters-schedule-identity — time groups (D-12, D-15, D-22)', () => {
  let timeGroupsService: { findAll: jest.Mock; findOne: jest.Mock };
  let tenantSettings: { getAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TimeGroupsAiAdapter;

  beforeEach(() => {
    timeGroupsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...SCHEDULE_A, intervals: [...SCHEDULE_A.intervals] }];
        if (uid === TENANT_B) return [{ ...SCHEDULE_B, intervals: [...SCHEDULE_B.intervals] }];
        return [];
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        const rows = uid === TENANT_A ? [SCHEDULE_A] : uid === TENANT_B ? [SCHEDULE_B] : [];
        return rows.find((row) => row.uid === id) ?? null;
      }),
    };
    tenantSettings = {
      getAll: jest.fn(async (uid: number) => ({
        timezone: uid === TENANT_A ? 'Europe/Moscow' : 'America/New_York',
      })),
    };
    registry = { register: jest.fn() };
    adapter = new TimeGroupsAiAdapter(timeGroupsService as any, registry as any, tenantSettings as any);
  });

  it('lists the tenant schedules with readable intervals', async () => {
    const result = (await getTool(adapter, 'list_time_groups').handler({}, TENANT_A)) as {
      schedules: Array<{ name: string; intervals: string[] }>;
    };
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].name).toBe('office-hours');
    expect(result.schedules[0].intervals[0]).toMatch(/09:00/);
    expect(result.schedules[0].intervals[0]).toMatch(/18:00/);
    expect(JSON.stringify(result)).not.toContain('night-shift');
  });

  it('evaluates a named schedule inside its intervals and names the next boundary', async () => {
    const result = (await getTool(adapter, 'evaluate_time_group').handler(
      { name: 'office-hours', at: MOSCOW_WED_NOON },
      TENANT_A,
    )) as { inside: boolean; next_boundary: string; timezone: string };
    expect(result.inside).toBe(true);
    expect(result.timezone).toBe('Europe/Moscow');
    expect(result.next_boundary).toMatch(/18:00/);
  });

  it('evaluates the same instant outside hours and names the next open boundary', async () => {
    const result = (await getTool(adapter, 'evaluate_time_group').handler(
      { name: 'office-hours', at: MOSCOW_WED_EVENING },
      TENANT_A,
    )) as { inside: boolean; next_boundary: string };
    expect(result.inside).toBe(false);
    expect(result.next_boundary).toMatch(/09:00/);
  });

  it('uses the tenant timezone, not the server zone', async () => {
    const moscow = (await getTool(adapter, 'evaluate_time_group').handler(
      { name: 'office-hours', at: MOSCOW_WED_EVENING },
      TENANT_A,
    )) as { inside: boolean; timezone: string };
    expect(moscow.timezone).toBe('Europe/Moscow');
    expect(moscow.inside).toBe(false);

    tenantSettings.getAll.mockResolvedValue({ timezone: 'America/New_York' });
    timeGroupsService.findAll.mockImplementation(async (uid: number) => {
      if (uid === TENANT_B) return [{ ...SCHEDULE_A, user_uid: TENANT_B, intervals: [...SCHEDULE_A.intervals] }];
      return [];
    });

    const york = (await getTool(adapter, 'evaluate_time_group').handler(
      { name: 'office-hours', at: MOSCOW_WED_EVENING },
      TENANT_B,
    )) as { inside: boolean; timezone: string };
    expect(york.timezone).toBe('America/New_York');
    expect(york.inside).toBe(true);
    expect(york.inside).not.toBe(moscow.inside);
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
    }
  });

  it('returns none of another tenant schedules', async () => {
    const result = (await getTool(adapter, 'list_time_groups').handler({}, TENANT_A)) as {
      schedules: Array<{ name: string }>;
    };
    expect(result.schedules.map((row) => row.name)).toEqual(['office-hours']);
    expect(timeGroupsService.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(timeGroupsService.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });

  it('ships a time-groups skill covering timezone-sensitive evaluation', () => {
    const skillPath = path.join(__dirname, '../../skills/time-groups/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: time-groups\r?\ndescription: .+\r?\n---/);
    expect(raw).toMatch(/маршрут|route|voicemail|голос/i);
    expect(raw).toMatch(/час|time.?zone|timezone|пояс/i);
  });
});
