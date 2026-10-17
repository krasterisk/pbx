import { AutodialInteractiveGuard } from './autodial-interactive.guard';
describe('Autodial confirmation HTTP boundary', () => {
  const context = (params: object) => ({ switchToHttp: () => ({ getRequest: () => ({ params, user: { sub: 7, vpbx_user_uid: 2 } }) }) }) as never;
  it('requires browser proof for an owned autodial proposal, without changing other modules', async () => {
    const findOne = jest.fn().mockResolvedValue({ apply_payload: { tool: 'add_autodial_dnc' } });
    const assert = jest.fn(() => { throw new Error('browser proof required'); });
    const guard = new AutodialInteractiveGuard({ findOne } as never, {} as never, {} as never, { assert } as never);
    await expect(guard.canActivate(context({ proposalId: 'own' }))).rejects.toThrow('browser proof');
    expect(findOne).toHaveBeenCalledWith({ where: { proposal_id: 'own', user_uid: 7, vpbx_user_uid: 2 } });
    findOne.mockResolvedValueOnce({ apply_payload: { tool: 'create_endpoint' } });
    await expect(guard.canActivate(context({ proposalId: 'other-module' }))).resolves.toBe(true);
    expect(assert).toHaveBeenCalledTimes(1);
  });
  it('checks every workflow step, including an autodial change after another domain', async () => {
    const assert = jest.fn(() => { throw new Error('browser proof required'); });
    const guard = new AutodialInteractiveGuard({} as never, { findOne: async () => ({ uid: 12 }) } as never,
      { findAll: async () => [{ tool: 'create_endpoint' }, { tool: 'create_autodial_base' }] } as never, { assert } as never);
    await expect(guard.canActivate(context({ workflowId: 'own' }))).rejects.toThrow('browser proof');
  });
});
