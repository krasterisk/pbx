import { QueryInterface } from 'sequelize';
import {
  CALL_GROUPS_TABLE,
  RING_OPTION_COLUMNS,
  runCallGroupsRingOptionsMigrate,
} from './migrate-call-groups-ring-options';

function makeHarness(existing: string[] = []) {
  const columns = new Set(existing);
  const added: Array<{ name: string; def: Record<string, unknown> }> = [];
  const logs: string[] = [];

  const qi = {
    describeTable: jest.fn(async () => {
      const described: Record<string, { allowNull?: boolean }> = {
        uid: {},
        name: {},
        exten: { allowNull: false },
      };
      for (const name of columns) {
        described[name] = { allowNull: name === 'greeting_prompt' || name === 'moh_class' };
      }
      return described;
    }),
    addColumn: jest.fn(async (_table: string, name: string, def: Record<string, unknown>) => {
      columns.add(name);
      added.push({ name, def });
    }),
  } as unknown as QueryInterface;

  return { qi, added, columns, logs };
}

describe('runCallGroupsRingOptionsMigrate (D-34)', () => {
  it('adds all ring-option columns with defaults equivalent to current behaviour', async () => {
    const { qi, added, logs } = makeHarness();
    const report = await runCallGroupsRingOptionsMigrate(qi, (m) => logs.push(m));

    expect(qi.addColumn).toHaveBeenCalledTimes(RING_OPTION_COLUMNS.length);
    const names = added.map((c) => c.name);
    expect(names).toEqual(RING_OPTION_COLUMNS.map((c) => c.name));

    const byName = Object.fromEntries(added.map((c) => [c.name, c.def]));
    expect(byName.confirm_external).toEqual(expect.objectContaining({ defaultValue: false }));
    expect(byName.skip_busy).toEqual(expect.objectContaining({ defaultValue: false }));
    expect(byName.use_moh_instead_of_ringback).toEqual(expect.objectContaining({ defaultValue: false }));
    expect(byName.dial_options).toEqual(expect.objectContaining({ defaultValue: 'tT' }));
    expect(report.applied).toEqual(RING_OPTION_COLUMNS.map((c) => c.name));
    expect(report.already).toEqual([]);
  });

  it('second run is a no-op and reports that columns already exist', async () => {
    const existing = RING_OPTION_COLUMNS.map((c) => c.name);
    const { qi, logs } = makeHarness(existing);
    const report = await runCallGroupsRingOptionsMigrate(qi, (m) => logs.push(m));

    expect(qi.addColumn).not.toHaveBeenCalled();
    expect(report.applied).toEqual([]);
    expect(report.already).toEqual(existing);
    expect(logs.some((l) => /already/i.test(l))).toBe(true);
    expect(CALL_GROUPS_TABLE).toBe('call_groups');
  });
});
