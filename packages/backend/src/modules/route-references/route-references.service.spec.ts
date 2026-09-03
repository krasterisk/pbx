import { RouteReferencesService } from './route-references.service';

describe('RouteReferencesService (D-48, T-14-03)', () => {
  let routeModel: { findAll: jest.Mock };
  let bindingModel: { findAll: jest.Mock };
  let service: RouteReferencesService;

  const tenantRoute = {
    uid: 5,
    user_uid: 100,
    actions: [{ id: 'to-ivr-7', type: 'toivr', params: { ivr_uid: 7 } }],
    raw_dialplan: '',
  };
  const otherTenantRoute = {
    uid: 99,
    user_uid: 200,
    actions: [{ id: 'foreign', type: 'toivr', params: { ivr_uid: 7 } }],
    raw_dialplan: 'exten => 1,1,NoOp()',
  };

  beforeEach(() => {
    routeModel = {
      findAll: jest.fn().mockImplementation(async (opts: { where?: { user_uid?: number } }) => {
        const uid = opts.where?.user_uid;
        return [tenantRoute, otherTenantRoute].filter((row) => row.user_uid === uid);
      }),
    };
    bindingModel = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    service = new RouteReferencesService(routeModel as any, bindingModel as any);
  });

  it('scopes every scan to vpbx_user_uid from the caller (JWT tenant)', async () => {
    const usage = await service.findUsage('ivr', 7, 100);

    expect(routeModel.findAll).toHaveBeenCalledWith({
      where: { user_uid: 100 },
      attributes: ['uid', 'actions', 'raw_dialplan'],
    });
    expect(usage.references).toEqual([
      expect.objectContaining({ routeUid: 5, actionOrBindingId: 'to-ivr-7' }),
    ]);
    expect(usage.references.some((hit) => hit.routeUid === 99)).toBe(false);
  });

  it('does not leak another tenant\'s routes even when they share the same ivr_uid', async () => {
    const foreign = await service.findReferences('ivr', 7, 200);
    expect(routeModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_uid: 200 } }),
    );
    expect(foreign).toEqual([
      expect.objectContaining({ routeUid: 99, actionOrBindingId: 'foreign' }),
    ]);
    expect(foreign.some((hit) => hit.routeUid === 5)).toBe(false);
  });

  it('sets hasRawDialplanRoutes when the tenant has any non-empty raw_dialplan', async () => {
    const empty = await service.findUsage('ivr', 7, 100);
    expect(empty.hasRawDialplanRoutes).toBe(false);
    expect(empty.meta.hasRawDialplanRoutes).toBe(false);

    const withRaw = await service.findUsage('ivr', 7, 200);
    expect(withRaw.hasRawDialplanRoutes).toBe(true);
    expect(withRaw.meta.hasRawDialplanRoutes).toBe(true);
  });

  it('loads directory bindings only for directory kind', async () => {
    await service.findUsage('ivr', 7, 100);
    expect(bindingModel.findAll).not.toHaveBeenCalled();

    await service.findUsage('directory', 7, 100);
    expect(bindingModel.findAll).toHaveBeenCalledWith({ where: { user_uid: 100 } });
  });
});
