import { ContextsService } from './contexts.service';

describe('ContextsService defaults transaction', () => {
  function fixture() {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const row: any = { uid: 7, name: 'ctx100', update: jest.fn(), destroy: jest.fn(), setDataValue: jest.fn((key, value) => { row[key] = value; }) };
    const model = { findOne: jest.fn(async () => row), findAll: jest.fn(async () => [row]), create: jest.fn(async () => row), destroy: jest.fn(async () => 1) };
    const settings = { getContextDefaults: jest.fn(async () => ({ endpoints: 7, trunks: 0 })), setContextDefault: jest.fn() };
    const sequelize = { transaction: jest.fn(async (callback) => callback(transaction)) };
    const includes = { lockTenantGraph: jest.fn(), replace: jest.fn(), removeReferences: jest.fn(), getOrderedMap: jest.fn(async () => new Map()) };
    const service = new ContextsService(model as never, {} as never, settings as never, sequelize as never, includes as never);
    return { service, transaction, row, model, settings, sequelize };
  }
  it('creates the context and both designated defaults in one transaction and returns computed flags', async () => {
    const f = fixture();
    const result = await f.service.create({ name: 'ctx100', is_default_for_endpoints: true, is_default_for_trunks: true }, 100);
    expect(f.model.create).toHaveBeenCalledWith({ name: 'ctx100', comment: '', user_uid: 100 }, { transaction: f.transaction });
    expect(f.settings.setContextDefault.mock.calls).toEqual([[100, 'endpoints', 7, true, f.transaction], [100, 'trunks', 7, true, f.transaction]]);
    expect(result.is_default_for_endpoints).toBe(true);
    expect(result.is_default_for_trunks).toBe(false);
  });
  it('locks the tenant-owned context and only changes flags present in the patch', async () => {
    const f = fixture();
    await f.service.update(7, { is_default_for_trunks: true }, 100);
    expect(f.model.findOne).toHaveBeenCalledWith({ where: { uid: 7, user_uid: 100 }, transaction: f.transaction, lock: 'UPDATE' });
    expect(f.row.update).toHaveBeenCalledWith({}, { transaction: f.transaction });
    expect(f.settings.setContextDefault.mock.calls).toEqual([[100, 'trunks', 7, true, f.transaction]]);
  });
  it('rejects a foreign/missing context before writing defaults', async () => {
    const f = fixture();
    f.model.findOne.mockResolvedValueOnce(null);
    await expect(f.service.update(7, { is_default_for_trunks: true }, 200)).rejects.toThrow('Context not found');
    expect(f.settings.setContextDefault).not.toHaveBeenCalled();
  });
  it('clears both references on removal using the same transaction as context destruction', async () => {
    const f = fixture();
    await f.service.remove(7, 100);
    expect(f.settings.setContextDefault.mock.calls).toEqual([[100, 'endpoints', 7, false, f.transaction], [100, 'trunks', 7, false, f.transaction]]);
    expect(f.row.destroy).toHaveBeenCalledWith({ transaction: f.transaction });
  });

  it.each(['two words', 'Internal', 'Межгород', 'a.b', 'a--b', 'a_', 'a'.repeat(65)])('rejects invalid identifier %s before any database write', async (name) => {
    const f = fixture();
    await expect(f.service.create({ name }, 100)).rejects.toThrow('Context identifier');
    await expect(f.service.update(7, { name }, 100)).rejects.toThrow('Context identifier');
    expect(f.sequelize.transaction).not.toHaveBeenCalled();
    expect(f.model.create).not.toHaveBeenCalled();
    expect(f.row.update).not.toHaveBeenCalled();
  });

});
