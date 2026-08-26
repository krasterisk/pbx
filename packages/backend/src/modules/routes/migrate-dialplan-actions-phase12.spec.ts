import { migrateAction, UNMAPPED_HARD_REMOVE } from './dialplan-actions-migration.util';
import {
  PHASE12_ACTION_TARGETS,
  runPhase12ActionMigration,
  type MigrationIo,
  type MigrationStore,
  type Phase12ActionTarget,
  type TargetRow,
} from './migrate-dialplan-actions-phase12';

function makeIo(): MigrationIo & { logs: string[]; backups: Array<{ path: string; data: unknown }> } {
  const logs: string[] = [];
  const backups: Array<{ path: string; data: unknown }> = [];
  return {
    logs,
    backups,
    async writeBackup(filePath, data) {
      backups.push({ path: filePath, data });
    },
    log: (line) => logs.push(line),
    now: () => new Date('2026-08-19T10:00:00.000Z'),
  };
}

function makeStore(rowsByKey: Record<string, TargetRow[]>): MigrationStore & { updates: Array<{ table: string; column: string; id: number; value: unknown }> } {
  const updates: Array<{ table: string; column: string; id: number; value: unknown }> = [];
  return {
    updates,
    async findAll(target: Phase12ActionTarget) {
      return rowsByKey[`${target.table}.${target.column}`] ?? [];
    },
    async update(target, id, value) {
      updates.push({ table: target.table, column: target.column, id, value });
    },
  };
}

describe('migrateAction priority lift', () => {
  it('rewrites numeric toqueue priority into fixed ValueSource', () => {
    const result = migrateAction({
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' }, priority: 5 },
    });
    expect(result.changed).toBe(true);
    expect(result.action).toEqual({
      type: 'toqueue',
      params: {
        target: { source: 'fixed', value: 'sales' },
        priority: { source: 'fixed', value: '5' },
      },
    });
  });
});

const legacyQueue = { type: 'toqueue', params: { queue: 'sales' } };
const already = { type: 'toqueue', params: { target: { source: 'fixed', value: 'sales' } } };
const unmappedType = [...UNMAPPED_HARD_REMOVE][0];
const unmappedAction = { type: unmappedType, params: { silence_timeout: 3 } };

describe('migrate-dialplan-actions-phase12', () => {
  it('lists exactly the six JSON action-chain columns', () => {
    expect(PHASE12_ACTION_TARGETS).toHaveLength(6);
    expect(PHASE12_ACTION_TARGETS.map((t) => `${t.table}.${t.column}`)).toEqual([
      'routes.actions',
      'route_phonebook_bindings.actions',
      'ivrs.menu_items',
      'voice_robot_keywords.actions',
      'voice_robots.fallback_action',
      'voice_robots.max_retries_action',
    ]);
  });

  it('calls migrateAction once per action in every target chain', async () => {
    const migrate = jest.fn(migrateAction);
    const store = makeStore({
      'routes.actions': [{ id: 1, value: [legacyQueue, already] }],
      'route_phonebook_bindings.actions': [{ id: 2, value: [legacyQueue] }],
      'ivrs.menu_items': [{ id: 3, value: [{ digit: '1', actions: [legacyQueue] }, { digit: '2', actions: [already] }] }],
      'voice_robot_keywords.actions': [{ id: 4, value: [legacyQueue] }],
      'voice_robots.fallback_action': [{ id: 5, value: [legacyQueue] }],
      'voice_robots.max_retries_action': [{ id: 6, value: [already] }],
    });
    const io = makeIo();

    await runPhase12ActionMigration({
      dryRun: false,
      store,
      io,
      backupDir: '/tmp/.backup',
      migrate,
    });

    expect(migrate).toHaveBeenCalledTimes(8);
  });

  it('does not call update when every action is already migrated', async () => {
    const store = makeStore({
      'routes.actions': [{ id: 1, value: [already] }],
      'route_phonebook_bindings.actions': [],
      'ivrs.menu_items': [{ id: 3, value: [{ digit: '1', actions: [already] }] }],
      'voice_robot_keywords.actions': [],
      'voice_robots.fallback_action': [],
      'voice_robots.max_retries_action': [],
    });
    const io = makeIo();

    const result = await runPhase12ActionMigration({
      dryRun: false,
      store,
      io,
      backupDir: '/tmp/.backup',
    });

    expect(store.updates).toHaveLength(0);
    expect(result.rowsChanged).toBe(0);
    expect(io.backups).toHaveLength(0);
  });

  it('dry-run prints counters and never writes', async () => {
    const store = makeStore({
      'routes.actions': [{ id: 1, value: [legacyQueue] }],
      'route_phonebook_bindings.actions': [],
      'ivrs.menu_items': [],
      'voice_robot_keywords.actions': [],
      'voice_robots.fallback_action': [],
      'voice_robots.max_retries_action': [],
    });
    const io = makeIo();

    const result = await runPhase12ActionMigration({
      dryRun: true,
      store,
      io,
      backupDir: '/tmp/.backup',
    });

    expect(store.updates).toHaveLength(0);
    expect(io.backups).toHaveLength(0);
    expect(result.rowsChanged).toBe(1);
    expect(io.logs.some((line) => line.includes('[dry-run] no UPDATE issued'))).toBe(true);
    expect(io.logs.some((line) => line.includes('routes.actions'))).toBe(true);
  });

  it('writes a backup of original values for every changed row', async () => {
    const store = makeStore({
      'routes.actions': [{ id: 11, value: [legacyQueue] }],
      'route_phonebook_bindings.actions': [],
      'ivrs.menu_items': [{ id: 33, value: [{ digit: '1', actions: [legacyQueue] }] }],
      'voice_robot_keywords.actions': [],
      'voice_robots.fallback_action': [],
      'voice_robots.max_retries_action': [],
    });
    const io = makeIo();

    const result = await runPhase12ActionMigration({
      dryRun: false,
      store,
      io,
      backupDir: '/tmp/.backup',
    });

    expect(store.updates).toHaveLength(2);
    expect(io.backups).toHaveLength(1);
    const entries = io.backups[0].data as Array<{ id: number; original: unknown }>;
    expect(entries).toHaveLength(result.rowsChanged);
    expect(entries.map((e) => e.id).sort()).toEqual([11, 33]);
    expect(io.backups[0].path).toContain('phase12-actions-');
  });

  it('leaves unmapped asr in place and lists the row id', async () => {
    const store = makeStore({
      'routes.actions': [{ id: 9, value: [unmappedAction] }],
      'route_phonebook_bindings.actions': [],
      'ivrs.menu_items': [],
      'voice_robot_keywords.actions': [],
      'voice_robots.fallback_action': [],
      'voice_robots.max_retries_action': [],
    });
    const io = makeIo();

    const result = await runPhase12ActionMigration({
      dryRun: false,
      store,
      io,
      backupDir: '/tmp/.backup',
    });

    expect(store.updates).toHaveLength(0);
    expect(result.unmapped).toEqual([
      { table: 'routes', column: 'actions', id: 9, type: unmappedType, index: 0 },
    ]);
    expect(io.logs.some((line) => line.includes('id=9') && line.includes(unmappedType))).toBe(true);
  });
});
