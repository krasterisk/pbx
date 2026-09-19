import { TenantRegistrationService } from './tenant-registration.service';

describe('TenantRegistrationService', () => {
  const input = { login: 'pilot', name: 'Owner', companyName: 'Pilot company', passwd: 'hashed',
    activationCode: '123456', activationExpires: 1000 };

  it('selects PBX profile in code and provisions both private contexts in the identity transaction', async () => {
    const transaction = {};
    const user = { uniqueid: 71 };
    const contexts = { bulkCreate: jest.fn().mockResolvedValue([]) };
    const identities = { create: jest.fn(async (_input, profile, provision) => {
      expect(profile).toBe('pbx');
      await provision(transaction, user);
      return { user, tenant: {} };
    }) };
    const service = new TenantRegistrationService(identities as any, contexts as any);
    expect(await service.create(input)).toBe(user);
    expect(identities.create).toHaveBeenCalledWith(expect.objectContaining({
      login: 'pilot', passwordHash: 'hashed', companyName: 'Pilot company',
    }), 'pbx', expect.any(Function));
    expect(contexts.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'ctx-71', user_uid: 71 }),
      expect.objectContaining({ name: 'ctx-71-ext', user_uid: 71 }),
    ], { transaction });
  });

  it('propagates PBX provisioning failure so the identity transaction can roll back', async () => {
    const contexts = { bulkCreate: jest.fn().mockRejectedValue(new Error('DDL unavailable')) };
    const identities = { create: jest.fn(async (_input, _profile, provision) =>
      provision({}, { uniqueid: 71 })) };
    const service = new TenantRegistrationService(identities as any, contexts as any);
    await expect(service.create(input)).rejects.toThrow('DDL unavailable');
  });
});
