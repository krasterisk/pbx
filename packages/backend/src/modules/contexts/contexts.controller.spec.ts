import { ContextsController } from './contexts.controller';
describe('context save and PBX apply state', () => {
  const user = { vpbx_user_uid: 100, level: 1 };
  const request = { user } as never;
  function fixture() {
    const row = { uid: 7, name: 'child', include_uids: [], toJSON: () => ({ uid: 7, name: 'child' }) };
    const service = { create: jest.fn(async () => row), update: jest.fn(async () => row), findOne: jest.fn(async () => row),
      findAll: jest.fn(async () => [row, { uid: 8, name: 'parent', include_uids: [7] }]), remove: jest.fn() };
    const apply = { applyContext: jest.fn(async () => ({ success: true })), clearContext: jest.fn() };
    const controller = new ContextsController(service as never, { get: () => apply } as never);
    return { controller, service, apply };
  }
  it('returns saved state when applying fails, so a create can be retried without duplicating it', async () => {
    const f = fixture();
    f.apply.applyContext.mockRejectedValueOnce(new Error('AMI unavailable'));
    expect(await f.controller.create({ name: 'child', include_uids: [] }, request)).toEqual({ uid: 7, name: 'child', dialplan_applied: false });
    expect(f.service.create).toHaveBeenCalledTimes(1);
    expect(await f.controller.applyContext('7', request)).toEqual({ dialplan_applied: true });
    expect(f.service.create).toHaveBeenCalledTimes(1);
  });
  it('clears a removed category and reapplies contexts that included it', async () => {
    const f = fixture();
    expect(await f.controller.remove('7', request)).toEqual({ deleted: true, dialplan_applied: true });
    expect(f.apply.clearContext).toHaveBeenCalledWith('child', 100);
    expect(f.apply.applyContext).toHaveBeenCalledWith(8, 100, true);
  });
});
