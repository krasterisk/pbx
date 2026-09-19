import { TenantsService } from './tenants.service';

describe('TenantsService analytics onboarding', () => {
  it('uses the isolated identity profile and omits PBX, billing, mail and password fields', async () => {
    const modules = { provisionCoreModules: jest.fn() };
    const billing = { createBalance: jest.fn() };
    const mailer = { sendTenantWelcome: jest.fn() };
    const logger = { logAction: jest.fn().mockRejectedValue(new Error('audit transport down')) };
    const identity = { create: jest.fn().mockResolvedValue({
      tenant: { id: 9, uid: 'tenant-uid', name: 'Analytics', status: 'trial',
        vpbx_user_uid: 71, max_extensions: 0 },
      user: { uniqueid: 71, login: 'owner@example.invalid', email: 'owner@example.invalid',
        passwd: 'stored-hash' },
    }) };
    const service = new TenantsService({} as any, {} as any, {} as any,
      mailer as any, logger as any, modules as any, billing as any,
      {} as any, {} as any, {} as any, identity as any);
    const response = await service.provisionAnalyticsIdentity({
      name: 'Analytics', email: 'owner@example.invalid', password: 'password123',
    }, 1);
    expect(identity.create).toHaveBeenCalledWith(expect.objectContaining({
      login: 'owner@example.invalid', activateImmediately: true,
      passwordHash: expect.any(String),
    }), 'analytics');
    expect(modules.provisionCoreModules).not.toHaveBeenCalled();
    expect(billing.createBalance).not.toHaveBeenCalled();
    expect(mailer.sendTenantWelcome).not.toHaveBeenCalled();
    expect(response).toEqual({
      tenant: { id: 9, uid: 'tenant-uid', name: 'Analytics', status: 'trial' },
      adminUser: { id: 71, login: 'owner@example.invalid', email: 'owner@example.invalid' },
    });
    expect(JSON.stringify(response)).not.toContain('stored-hash');
    expect(JSON.stringify(response)).not.toContain('password123');
  });
});
