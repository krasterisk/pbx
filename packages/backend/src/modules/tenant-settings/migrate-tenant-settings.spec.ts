import { QueryInterface } from 'sequelize';
import { runTenantSettingsMigrate } from './migrate-tenant-settings';

function mockQueryInterface(overrides: Partial<QueryInterface> = {}): QueryInterface {
  return {
    showAllTables: jest.fn().mockResolvedValue([]),
    createTable: jest.fn().mockResolvedValue(undefined),
    showIndex: jest.fn().mockResolvedValue([]),
    addIndex: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as QueryInterface;
}

describe('runTenantSettingsMigrate', () => {
  it('creates tenant_settings once when showAllTables is empty', async () => {
    const qi = mockQueryInterface();

    await runTenantSettingsMigrate(qi);

    expect(qi.createTable).toHaveBeenCalledTimes(1);
    expect(qi.createTable).toHaveBeenCalledWith(
      'tenant_settings',
      expect.objectContaining({
        id: expect.anything(),
        vpbx_user_uid: expect.anything(),
        key: expect.anything(),
        value: expect.anything(),
        category: expect.anything(),
      }),
    );
  });

  it('does not createTable when tenant_settings is already listed', async () => {
    const qi = mockQueryInterface({
      showAllTables: jest.fn().mockResolvedValue(['tenant_settings']),
      showIndex: jest.fn().mockResolvedValue([{ name: 'tenant_settings_vpbx_key_uniq' }]),
    });

    await runTenantSettingsMigrate(qi);

    expect(qi.createTable).not.toHaveBeenCalled();
  });

  it('adds unique composite index when tenant_settings_vpbx_key_uniq is missing', async () => {
    const qi = mockQueryInterface({
      showAllTables: jest.fn().mockResolvedValue(['tenant_settings']),
      showIndex: jest.fn().mockResolvedValue([]),
    });

    await runTenantSettingsMigrate(qi);

    expect(qi.addIndex).toHaveBeenCalledTimes(1);
    expect(qi.addIndex).toHaveBeenCalledWith(
      'tenant_settings',
      ['vpbx_user_uid', 'key'],
      expect.objectContaining({
        unique: true,
        name: 'tenant_settings_vpbx_key_uniq',
      }),
    );
  });

  it('does not addIndex when tenant_settings_vpbx_key_uniq already exists', async () => {
    const qi = mockQueryInterface({
      showAllTables: jest.fn().mockResolvedValue(['tenant_settings']),
      showIndex: jest.fn().mockResolvedValue([{ name: 'tenant_settings_vpbx_key_uniq' }]),
    });

    await runTenantSettingsMigrate(qi);

    expect(qi.addIndex).not.toHaveBeenCalled();
  });

  it('first empty run creates table+index once; second already-exists run is a no-op', async () => {
    const createTable = jest.fn().mockResolvedValue(undefined);
    const addIndex = jest.fn().mockResolvedValue(undefined);
    const empty = mockQueryInterface({ createTable, addIndex });

    await runTenantSettingsMigrate(empty);
    expect(createTable).toHaveBeenCalledTimes(1);
    expect(addIndex).toHaveBeenCalledTimes(1);

    createTable.mockClear();
    addIndex.mockClear();

    const existing = mockQueryInterface({
      showAllTables: jest.fn().mockResolvedValue(['tenant_settings']),
      showIndex: jest.fn().mockResolvedValue([{ name: 'tenant_settings_vpbx_key_uniq' }]),
      createTable,
      addIndex,
    });

    await runTenantSettingsMigrate(existing);
    expect(createTable).not.toHaveBeenCalled();
    expect(addIndex).not.toHaveBeenCalled();
  });
});
