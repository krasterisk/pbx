import { ContextIncludesService } from './context-includes.service';

describe('ordered tenant context includes', () => {
  function fixture(edges: { context_uid: number; include_uid: number }[] = []) {
    const tx = { LOCK: { UPDATE: 'UPDATE' } };
    const ci = { findAll: jest.fn(async () => edges), destroy: jest.fn(), bulkCreate: jest.fn() };
    const contexts = { findAll: jest.fn(async () => [1, 2, 3].map((uid) => ({ uid }))) };
    const db = { transaction: jest.fn(async (fn) => fn(tx)) };
    return { service: new ContextIncludesService(ci as never, contexts as never, db as never), ci, contexts, tx };
  }
  it('preserves requested order and locks tenant rows before graph writes', async () => {
    const f = fixture();
    await f.service.replace(1, [3, 2], 100);
    expect(f.contexts.findAll).toHaveBeenCalledWith({ where: { user_uid: 100 }, order: [['uid', 'ASC']], transaction: f.tx, lock: 'UPDATE' });
    expect(f.ci.bulkCreate).toHaveBeenCalledWith([
      { context_uid: 1, include_uid: 3, user_uid: 100, priority: 1 },
      { context_uid: 1, include_uid: 2, user_uid: 100, priority: 2 },
    ], { transaction: f.tx });
  });
  it.each([[1], [2, 2], [9], [0], [1.5]])('rejects invalid include IDs %j before writing', async (uids) => {
    const f = fixture();
    await expect(f.service.replace(1, uids as number[], 100)).rejects.toThrow();
    expect(f.ci.destroy).not.toHaveBeenCalled();
  });
  it('rejects a transitive cycle before replacing any rows', async () => {
    const f = fixture([{ context_uid: 2, include_uid: 3 }, { context_uid: 3, include_uid: 1 }]);
    await expect(f.service.replace(1, [2], 100)).rejects.toThrow('cycle');
    expect(f.ci.destroy).not.toHaveBeenCalled();
  });
  it('accepts a shared descendant without mistaking a diamond for a cycle', async () => {
    const f = fixture([{ context_uid: 2, include_uid: 3 }]);
    await f.service.replace(1, [2, 3], 100);
    expect(f.ci.bulkCreate).toHaveBeenCalled();
  });
  it('replaces old edges when validating the new graph', async () => {
    const f = fixture([{ context_uid: 1, include_uid: 2 }, { context_uid: 2, include_uid: 3 }]);
    await f.service.replace(1, [], 100);
    expect(f.ci.destroy).toHaveBeenCalledWith({ where: { context_uid: 1, user_uid: 100 }, transaction: f.tx });
    expect(f.ci.bulkCreate).not.toHaveBeenCalled();
  });
});
