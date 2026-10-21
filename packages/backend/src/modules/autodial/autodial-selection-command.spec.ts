import { AutodialAnalyticsController } from './autodial-analytics.controller';
import { AutodialReportSelectionService } from './autodial-report-selection.service';

describe('report selection create command', () => {
  const actor = { user: { vpbx_user_uid: 71, sub: 4, level: 3 } };
  it('copies inside the command transaction and loads the committed resource on replay', async () => {
    const transaction = { marker: 'same transaction' };
    const createBase = jest.fn().mockResolvedValue({ uid: 8 });
    const findOne = jest.fn().mockResolvedValue({ uid: 8, name: 'Copy' });
    const run = jest.fn().mockImplementationOnce(async (_tenant, _actor, _key, _operation, _body, write) => (await write(transaction)).uid)
      .mockResolvedValueOnce(8);
    const controller = new AutodialAnalyticsController({} as never, { createBase } as never,
      { run } as never, { findOne } as never);
    const body = { name: 'Copy', preview_hash: 'a'.repeat(64) };
    await expect(controller.createBase(actor, body, 'copy-key-001')).resolves.toEqual({ uid: 8, name: 'Copy' });
    expect(createBase).toHaveBeenCalledWith(71, 3, body, transaction);
    await controller.createBase(actor, body, 'copy-key-001');
    expect(createBase).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(71, 4, 'copy-key-001', 'create_base', body, expect.any(Function));
    expect(findOne).toHaveBeenCalledTimes(2);
  });
  it('refuses revoked write access before returning a completed command', async () => {
    const run = jest.fn();
    const controller = new AutodialAnalyticsController({} as never, {} as never, { run } as never, {} as never);
    await expect(controller.createBase({ user: { ...actor.user, level: 4 } }, {}, 'copy-key-001')).rejects.toMatchObject({ status: 403 });
    expect(run).not.toHaveBeenCalled();
  });
  it('retains preview revision checks and uses the externally owned transaction', async () => {
    const cloneContactsInTransaction = jest.fn().mockResolvedValue({ uid: 8 });
    const bases = { findOne: jest.fn().mockResolvedValue({ uid: 7, revision: 2 }), cloneContactsInTransaction, cloneContacts: jest.fn() };
    const service = new AutodialReportSelectionService({ selectedContactIds: async () => [3] } as never,
      bases as never, { findOne: async () => ({ uid: 1, base_uid: 7, revision: 4 }) } as never);
    const filter = { from: '2026-10-01', to: '2026-10-17', campaign_uids: [1], dimension: 'disposition', value: 'busy' };
    const preview = await service.preview(71, filter), transaction = {} as never;
    await service.createBase(71, 3, { filter, name: 'Copy', preview_hash: preview.preview_hash }, transaction);
    expect(cloneContactsInTransaction).toHaveBeenCalledWith(71, 7, [3], 'Copy', 2, 1, transaction);
    expect(bases.cloneContacts).not.toHaveBeenCalled();
    bases.findOne.mockResolvedValueOnce({ uid: 7, revision: 3 });
    await expect(service.createBase(71, 3, { filter, name: 'Copy', preview_hash: preview.preview_hash }, transaction)).rejects.toMatchObject({ status: 409 });
    expect(cloneContactsInTransaction).toHaveBeenCalledTimes(1);
  });
});
