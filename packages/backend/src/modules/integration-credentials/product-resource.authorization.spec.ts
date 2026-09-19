import { ProductResourceAuthorization } from './product-resource.authorization';

const context = Object.freeze({
  tenantUid: 42, principalId: 'user:7', principalKind: 'user' as const,
  permissionRevision: '1', requestId: 'r',
});
const reference = {
  product: 'speech_analytics' as const, action: 'analytics:read',
  resourceKind: 'project' as const,
  resourceId: '00000000-0000-4000-8000-000000000001',
};

describe('ProductResourceAuthorization', () => {
  it('fails closed without a compiled resolver and for mismatched product/resource pair', async () => {
    const auth = new ProductResourceAuthorization([]);
    await expect(auth.authorize(context, reference)).rejects.toMatchObject({ status: 404 });
    await expect(auth.authorize(context, { ...reference, resourceKind: 'deployment' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('gives the resolver exact tenant UID and returns the same 404 for foreign and missing', async () => {
    const resolver = {
      product: 'speech_analytics' as const, resourceKind: 'project' as const,
      findForTenant: jest.fn().mockResolvedValue(null), canAct: jest.fn(),
    };
    const auth = new ProductResourceAuthorization([resolver]);
    await expect(auth.authorize(context, reference)).rejects.toMatchObject({ status: 404 });
    expect(resolver.findForTenant).toHaveBeenCalledWith(42, reference.resourceId);
    expect(resolver.canAct).not.toHaveBeenCalled();
    resolver.findForTenant.mockResolvedValue({ id: reference.resourceId });
    resolver.canAct.mockResolvedValue(false);
    await expect(auth.authorize(context, reference)).rejects.toMatchObject({ status: 403 });
    resolver.canAct.mockResolvedValue(true);
    await expect(auth.authorize(context, reference)).resolves.toBeUndefined();
  });
});
