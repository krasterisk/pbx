import * as fs from 'fs';
import * as path from 'path';
import { TimeGroupsAiAdapter } from '../time-groups/time-groups-ai.adapter';
import { NumbersAiAdapter } from '../numbers/numbers-ai.adapter';
import { PORTAL_USER_FIELDS, UsersAiAdapter, toPortalUserView } from '../users/users-ai.adapter';
import { UserLevel } from '../users/user.model';

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

const DID_A = {
  id: 1,
  name: 'Moscow DID',
  number: '74951234567',
  status: 'active',
  user_uid: TENANT_A,
};

const DID_A_SPARE = {
  id: 2,
  name: 'Spare DID',
  number: '74950000000',
  status: 'spare',
  user_uid: TENANT_A,
};

const DID_B = {
  id: 9,
  name: 'Other DID',
  number: '78125550000',
  status: 'active',
  user_uid: TENANT_B,
};

const ROUTE_A = {
  uid: 21,
  name: 'Inbound Sales',
  extensions: ['74951234567'],
  actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '201' } } }],
  user_uid: TENANT_A,
};

const ROUTE_B = {
  uid: 88,
  name: 'Other Inbound',
  extensions: ['78125550000'],
  actions: [{ type: 'toqueue', params: { queue: 'other' } }],
  user_uid: TENANT_B,
};

describe('read-adapters-schedule-identity — numbers (D-12, D-15, D-22)', () => {
  let numbersService: { findAll: jest.Mock; findById: jest.Mock };
  let routesService: { findAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: NumbersAiAdapter;

  beforeEach(() => {
    numbersService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...DID_A }, { ...DID_A_SPARE }];
        if (uid === TENANT_B) return [{ ...DID_B }];
        return [];
      }),
      findById: jest.fn(async (id: number, uid: number) => {
        const rows = uid === TENANT_A ? [DID_A, DID_A_SPARE] : uid === TENANT_B ? [DID_B] : [];
        return rows.find((row) => row.id === id) ?? null;
      }),
    };
    routesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...ROUTE_A, extensions: [...ROUTE_A.extensions] }];
        if (uid === TENANT_B) return [{ ...ROUTE_B, extensions: [...ROUTE_B.extensions] }];
        return [];
      }),
    };
    registry = { register: jest.fn() };
    adapter = new NumbersAiAdapter(numbersService as any, registry as any, routesService as any);
  });

  it('lists the tenant numbers with status and assignment', async () => {
    const result = (await getTool(adapter, 'list_numbers').handler({}, TENANT_A)) as {
      numbers: Array<{ number: string; status: string; assignment: string | null }>;
    };
    expect(result.numbers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: '74951234567',
          status: 'active',
          assignment: 'Inbound Sales',
        }),
        expect.objectContaining({
          number: '74950000000',
          status: 'spare',
          assignment: null,
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('78125550000');
  });

  it('describes a number with the route and destination it currently reaches', async () => {
    const result = (await getTool(adapter, 'describe_number').handler(
      { number: '74951234567' },
      TENANT_A,
    )) as {
      number: string;
      routed: boolean;
      route: { name: string };
      destination: string;
    };
    expect(result.number).toBe('74951234567');
    expect(result.routed).toBe(true);
    expect(result.route.name).toBe('Inbound Sales');
    expect(result.destination).toMatch(/toexten/);
    expect(result.destination).toMatch(/201/);
  });

  it('reports an unrouted number as unrouted rather than omitting it', async () => {
    const result = (await getTool(adapter, 'describe_number').handler(
      { number: '74950000000' },
      TENANT_A,
    )) as { number: string; routed: boolean; destination: string; route: unknown };
    expect(result.number).toBe('74950000000');
    expect(result.routed).toBe(false);
    expect(result.destination).toMatch(/unrouted/i);
    expect(result.route).toBeNull();
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
    }
  });

  it('returns none of another tenant numbers', async () => {
    const result = (await getTool(adapter, 'list_numbers').handler({}, TENANT_A)) as {
      numbers: Array<{ number: string }>;
    };
    expect(result.numbers.map((row) => row.number).sort()).toEqual(['74950000000', '74951234567']);
    expect(numbersService.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(numbersService.findAll).not.toHaveBeenCalledWith(TENANT_B);
    expect(routesService.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(routesService.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });

  it('ships a numbers skill covering format, status and resolved destination', () => {
    const skillPath = path.join(__dirname, '../../skills/numbers/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: numbers\r?\ndescription: .+\r?\n---/);
    expect(raw).toMatch(/маршрут|route/i);
    expect(raw).toMatch(/unrouted|не маршрут|не назнач/i);
    expect(raw).toMatch(/describe_number|назначени/i);
  });
});

const USER_A = {
  uniqueid: 1,
  name: 'Alice Admin',
  login: 'alice',
  level: UserLevel.ADMIN,
  role: 1,
  last_activity: '2026-09-01T10:00:00.000Z',
  passwd: 'should-never-leak',
  activationCode: '654321',
  refreshToken: 'refresh-a',
};

const USER_A2 = {
  uniqueid: 2,
  name: 'Omar Operator',
  login: 'omar',
  level: UserLevel.OPERATOR,
  role: 0,
  last_activity: '2026-09-02T08:00:00.000Z',
  passwd: 'hash-a2',
};

const USER_B = {
  uniqueid: 9,
  name: 'Bob Other',
  login: 'bob',
  level: UserLevel.SUPERVISOR,
  role: 3,
  last_activity: '2026-08-01T00:00:00.000Z',
  passwd: 'hash-b',
  sessionId: 'sess-b',
};

describe('read-adapters-schedule-identity — portal users (D-15, D-22)', () => {
  let usersService: { findAll: jest.Mock; findById: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: UsersAiAdapter;

  beforeEach(() => {
    usersService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...USER_A }, { ...USER_A2 }];
        if (uid === TENANT_B) return [{ ...USER_B }];
        return [];
      }),
      findById: jest.fn(async (id: number, uid: number) => {
        const rows = uid === TENANT_A ? [USER_A, USER_A2] : uid === TENANT_B ? [USER_B] : [];
        return rows.find((row) => row.uniqueid === id) ?? null;
      }),
    };
    registry = { register: jest.fn() };
    adapter = new UsersAiAdapter(usersService as any, registry as any);
  });

  it('lists portal users with display name, role and last activity', async () => {
    const result = (await getTool(adapter, 'list_portal_users').handler({}, TENANT_A)) as {
      users: Array<{ name: string; role: string; last_activity: string }>;
    };
    expect(result.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Alice Admin',
          role: 'ADMIN',
          last_activity: '2026-09-01T10:00:00.000Z',
        }),
        expect.objectContaining({
          name: 'Omar Operator',
          role: 'OPERATOR',
        }),
      ]),
    );
  });

  it('never returns a password hash, token, secret or session identifier', async () => {
    const listed = await getTool(adapter, 'list_portal_users').handler({}, TENANT_A);
    const described = await getTool(adapter, 'describe_portal_user').handler({ uid: 1 }, TENANT_A);
    const blob = JSON.stringify(listed) + JSON.stringify(described);
    expect(blob).not.toMatch(/should-never-leak|hash-a2|refresh-a|654321|sess-b|passwd|refreshToken|sessionId|activationCode/i);
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
    }
  });

  it('returns none of another tenant users including no aggregate count of them', async () => {
    const result = (await getTool(adapter, 'list_portal_users').handler({}, TENANT_A)) as {
      users: Array<{ name: string }>;
      count?: number;
      total?: number;
    };
    expect(result.users.map((row) => row.name).sort()).toEqual(['Alice Admin', 'Omar Operator']);
    expect(JSON.stringify(result)).not.toContain('Bob Other');
    expect(result.count).toBeUndefined();
    expect(result.total).toBeUndefined();
    expect(result.users).toHaveLength(2);
    expect(usersService.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(usersService.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });

  it('asserts secret absence against the declared output shape, not only fixtures', () => {
    expect([...PORTAL_USER_FIELDS].sort()).toEqual(['last_activity', 'name', 'role', 'uid']);
    for (const field of PORTAL_USER_FIELDS) {
      expect(field).not.toMatch(/password|passwd|token|secret|session|hash|activation|refresh/i);
    }
    const fat = {
      uniqueid: 7,
      name: 'Fat User',
      level: UserLevel.READONLY,
      last_activity: '2026-01-01T00:00:00.000Z',
      passwd: 'hash',
      password: 'plain',
      refreshToken: 'tok',
      sessionId: 'sid',
      activationCode: 'code',
      secret: 'sek',
      login: 'fat',
      email: 'fat@example.test',
    };
    const view = toPortalUserView(fat);
    expect(Object.keys(view).sort()).toEqual([...PORTAL_USER_FIELDS].sort());
    expect(JSON.stringify(view)).not.toMatch(/hash|plain|tok|sid|code|sek|fat@|login/i);
  });

  it('ships a users skill covering roles and the read-only access boundary', () => {
    const skillPath = path.join(__dirname, '../../skills/users/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: users\r?\ndescription: .+\r?\n---/);
    expect(raw).toMatch(/ADMIN|OPERATOR|READONLY/i);
    expect(raw).toMatch(/не меня|never change|только чтен|read-only/i);
  });
});
