import { TenantContextGuard } from './tenant-context.guard';

function fixture() {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 7, level: 1, role: 0, vpbx_user_uid: 42, iat: 10 }) };
  const config = { get: jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef') };
  const resolver = { fromUserClaims: jest.fn().mockResolvedValue(Object.freeze({
    tenantUid: 42, principalId: 'user:7', principalKind: 'user',
    permissionRevision: '1', requestId: 'generated',
  })) };
  const credentials = { authenticate: jest.fn().mockResolvedValue(Object.freeze({
    tenantUid: 42, principalId: '00000000-0000-4000-8000-000000000001',
    principalKind: 'integration', credentialId: '00000000-0000-4000-8000-000000000002',
    permissionRevision: '1', requestId: 'generated',
  })) };
  const limiter = { check: jest.fn(), failure: jest.fn() };
  const guard = new TenantContextGuard(jwt as any, config as any, resolver as any,
    credentials as any, limiter as any);
  const request: any = { headers: { authorization: 'Bearer a.b.c' }, params: {} };
  const execution: any = { switchToHttp: () => ({ getRequest: () => request }) };
  return { guard, jwt, resolver, credentials, limiter, request, execution };
}

describe('TenantContextGuard', () => {
  it('attaches only the server-resolved context from a header JWT', async () => {
    const f = fixture();
    await expect(f.guard.canActivate(f.execution)).resolves.toBe(true);
    expect(f.request.tenantContext).toMatchObject({ tenantUid: 42 });
    expect(f.jwt.verifyAsync).toHaveBeenCalledWith('a.b.c', expect.objectContaining({
      issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client',
    }));
  });

  it('rejects body context and path tenant mismatch for either credential', async () => {
    const f = fixture();
    f.request.body = { tenantUid: 9 };
    await expect(f.guard.canActivate(f.execution)).rejects.toMatchObject({ status: 400 });
    f.request.body = {};
    f.request.params.tenantUid = '9';
    await expect(f.guard.canActivate(f.execution)).rejects.toMatchObject({ status: 404 });
    f.request.params = {};
    f.request.headers.authorization = `Bearer krint_v1_${'A'.repeat(22)}_${'b'.repeat(43)}`;
    await expect(f.guard.canActivate(f.execution)).resolves.toBe(true);
    expect(f.credentials.authenticate).toHaveBeenCalledWith('A'.repeat(22), 'b'.repeat(43), expect.any(String));
    expect(f.limiter.check).toHaveBeenCalledWith('unknown', 'A'.repeat(22));
    expect(f.jwt.verifyAsync).toHaveBeenCalledTimes(1);
  });
});
