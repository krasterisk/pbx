import { TenantRegistrationService } from './tenant-registration.service';

describe('TenantRegistrationService', () => {
  const input = { login: 'pilot', name: 'Owner', companyName: 'Pilot company', passwd: 'hashed', activationCode: '123456', activationExpires: 1000 };
  function fixture() {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const user = { uniqueid: 71, update: jest.fn().mockResolvedValue(undefined) };
    const users = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(user) };
    const tenants = { create: jest.fn().mockResolvedValue({}) };
    const contexts = { bulkCreate: jest.fn().mockResolvedValue([]) };
    const sequelize = { transaction: jest.fn(fn => fn(transaction)) };
    return { service: new TenantRegistrationService(sequelize as any, users as any, tenants as any, contexts as any), users, tenants, contexts, user, transaction };
  }
  it('creates the owner, tenant and two private contexts in one transaction', async () => {
    const f = fixture(); await f.service.create(input);
    expect(f.user.update).toHaveBeenCalledWith({ vpbx_user_uid: 71 }, { transaction: f.transaction });
    expect(f.tenants.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pilot company', owner_user_id: 71, vpbx_user_uid: 71, max_extensions: 10 }), { transaction: f.transaction });
    expect(f.contexts.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'ctx-71', user_uid: 71 }),
      expect.objectContaining({ name: 'ctx-71-ext', user_uid: 71 }),
    ], { transaction: f.transaction });
  });
  it('rejects duplicate identities before provisioning', async () => {
    const f = fixture(); f.users.findOne.mockResolvedValue({} as never);
    await expect(f.service.create(input)).rejects.toThrow('уже существует');
    expect(f.users.create).not.toHaveBeenCalled();
  });
  it('propagates context provisioning failure to roll back the transaction', async () => {
    const f = fixture(); f.contexts.bulkCreate.mockRejectedValue(new Error('DDL unavailable'));
    await expect(f.service.create(input)).rejects.toThrow('DDL unavailable');
  });
});
