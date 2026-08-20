import { QueryInterface } from 'sequelize';
import {
  assignedExtenForUid,
  CALL_GROUPS_EXTEN_INDEX,
  CALL_GROUPS_TABLE,
  collectOccupiedExtens,
  runCallGroupsExtenMigrate,
} from './migrate-call-groups-exten';

interface GroupRow {
  uid: number;
  vpbx_user_uid: number;
  name: string;
  exten: string | null;
}

function makeHarness(init?: {
  hasColumn?: boolean;
  allowNull?: boolean;
  hasIndex?: boolean;
  groups?: GroupRow[];
  queues?: Array<{ name: string }>;
  endpoints?: Array<{ id: string }>;
}) {
  const state = {
    hasColumn: init?.hasColumn ?? false,
    allowNull: init?.allowNull ?? true,
    hasIndex: init?.hasIndex ?? false,
    groups: (init?.groups ?? []).map((g) => ({ ...g })),
    queues: init?.queues ?? [],
    endpoints: init?.endpoints ?? [],
  };

  const logs: string[] = [];

  const qi = {
    describeTable: jest.fn(async () => {
      if (!state.hasColumn) return { uid: {}, name: {}, vpbx_user_uid: {} };
      return {
        uid: {},
        name: {},
        vpbx_user_uid: {},
        exten: { allowNull: state.allowNull, type: 'VARCHAR(8)' },
      };
    }),
    addColumn: jest.fn(async () => {
      state.hasColumn = true;
      state.allowNull = true;
    }),
    changeColumn: jest.fn(async () => {
      state.allowNull = false;
    }),
    showIndex: jest.fn(async () => (state.hasIndex ? [{ name: CALL_GROUPS_EXTEN_INDEX }] : [])),
    addIndex: jest.fn(async () => {
      state.hasIndex = true;
    }),
  } as unknown as QueryInterface;

  const query = jest.fn(async (sql: string, options?: { replacements?: Record<string, unknown> }) => {
    if (sql.includes('FROM call_groups') && sql.includes('COUNT(*)')) {
      const n = state.groups.filter((g) => g.exten == null || g.exten === '').length;
      return [[{ n }]];
    }
    if (sql.includes('FROM call_groups')) {
      return [state.groups.map((g) => ({ ...g }))];
    }
    if (sql.includes('FROM queue_table')) {
      return [state.queues];
    }
    if (sql.includes('FROM ps_endpoints')) {
      return [state.endpoints];
    }
    if (sql.startsWith('UPDATE call_groups SET exten')) {
      const uid = Number(options?.replacements?.uid);
      const exten = String(options?.replacements?.exten ?? '');
      const row = state.groups.find((g) => g.uid === uid);
      if (row && (row.exten == null || row.exten === '')) row.exten = exten;
      return [[]];
    }
    return [[]];
  });

  return { qi, query, state, logs };
}

describe('assignedExtenForUid', () => {
  it('uses prefix 6 and 3-digit pad: uid 7 → 6007, uid 15 → 6015', () => {
    expect(assignedExtenForUid(7)).toBe('6007');
    expect(assignedExtenForUid(15)).toBe('6015');
    expect(assignedExtenForUid(999)).toBe('6999');
  });
});

describe('collectOccupiedExtens', () => {
  it('keys occupancy by tenant so the same number in another vpbx is not a conflict', () => {
    const occupied = collectOccupiedExtens({
      groups: [{ uid: 1, vpbx: 1, exten: '6001' }],
      queues: [{ name: 'q200_2' }],
      endpoints: [{ id: 'e101_2' }],
    });
    expect(occupied.get('1:6001')).toBe('call_groups.uid=1');
    expect(occupied.get('2:200')).toBe('queue_table.name=q200_2');
    expect(occupied.get('2:101')).toBe('ps_endpoints.id=e101_2');
    expect(occupied.has('1:200')).toBe(false);
  });
});

describe('runCallGroupsExtenMigrate', () => {
  it('applies all four steps on a fresh table and fills deterministic numbers', async () => {
    const { qi, query, state, logs } = makeHarness({
      groups: [
        { uid: 7, vpbx_user_uid: 42, name: 'Sales', exten: null },
        { uid: 15, vpbx_user_uid: 42, name: 'Support', exten: null },
      ],
    });

    const report = await runCallGroupsExtenMigrate(qi, query, (m) => logs.push(m));

    expect(qi.addColumn).toHaveBeenCalledWith(
      CALL_GROUPS_TABLE,
      'exten',
      expect.objectContaining({ allowNull: true }),
    );
    expect(state.groups[0].exten).toBe('6007');
    expect(state.groups[1].exten).toBe('6015');
    expect(qi.addIndex).toHaveBeenCalledWith(
      CALL_GROUPS_TABLE,
      ['vpbx_user_uid', 'exten'],
      expect.objectContaining({ unique: true, name: CALL_GROUPS_EXTEN_INDEX }),
    );
    expect(qi.changeColumn).toHaveBeenCalledWith(
      CALL_GROUPS_TABLE,
      'exten',
      expect.objectContaining({ allowNull: false }),
    );
    expect(report).toEqual({
      addColumn: 'applied',
      fillExten: 'applied',
      addIndex: 'applied',
      notNull: 'applied',
      filled: 2,
      remainingNull: 0,
    });
    expect(state.groups.every((g) => g.exten != null)).toBe(true);
  });

  it('second run is a no-op on every step and prints already applied', async () => {
    const { qi, query, logs } = makeHarness({
      hasColumn: true,
      allowNull: false,
      hasIndex: true,
      groups: [
        { uid: 7, vpbx_user_uid: 42, name: 'Sales', exten: '6007' },
      ],
    });

    const report = await runCallGroupsExtenMigrate(qi, query, (m) => logs.push(m));

    expect(qi.addColumn).not.toHaveBeenCalled();
    expect(qi.addIndex).not.toHaveBeenCalled();
    expect(qi.changeColumn).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false);
    expect(report.addColumn).toBe('already');
    expect(report.fillExten).toBe('already');
    expect(report.addIndex).toBe('already');
    expect(report.notNull).toBe('already');
    expect(report.remainingNull).toBe(0);
    expect(logs.some((l) => l.includes('all four steps already applied'))).toBe(true);
  });

  it('aborts fill with listed conflicts when assigned number hits a queue or internal', async () => {
    const { qi, query, logs } = makeHarness({
      hasColumn: true,
      groups: [{ uid: 7, vpbx_user_uid: 42, name: 'Sales', exten: null }],
      queues: [{ name: 'q6007_42' }],
      endpoints: [{ id: 'e101_42' }],
    });

    await expect(runCallGroupsExtenMigrate(qi, query, (m) => logs.push(m))).rejects.toThrow(
      /q6007_42/,
    );
    await expect(runCallGroupsExtenMigrate(qi, query, (m) => logs.push(m))).rejects.toThrow(
      /collisions/,
    );
    expect(qi.addIndex).not.toHaveBeenCalled();
    expect(qi.changeColumn).not.toHaveBeenCalled();
  });

  it('does not treat the same number in another tenant as a collision', async () => {
    const { qi, query, state, logs } = makeHarness({
      hasColumn: true,
      groups: [{ uid: 7, vpbx_user_uid: 42, name: 'Sales', exten: null }],
      queues: [{ name: 'q6007_99' }],
      endpoints: [{ id: 'e6007_99' }],
    });

    const report = await runCallGroupsExtenMigrate(qi, query, (m) => logs.push(m));
    expect(state.groups[0].exten).toBe('6007');
    expect(report.fillExten).toBe('applied');
    expect(report.remainingNull).toBe(0);
  });
});
