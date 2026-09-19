import { UniqueConstraintError } from 'sequelize';
import { TenantIdentityService } from './tenant-identity.service';

function fixture() {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const user = { uniqueid: 71, update: jest.fn().mockResolvedValue(undefined) };
  const tenant = { id: 9, vpbx_user_uid: 71 };
  const users = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(user) };
  const tenants = { create: jest.fn().mockResolvedValue(tenant) };
  const sequelize = { transaction: jest.fn(fn => fn(transaction)) };
  const service = new TenantIdentityService(sequelize as any, users as any, tenants as any);
  return { service, transaction, user, tenant, users, tenants, sequelize };
}

const input = { login: 'Analytics', name: 'Owner', companyName: 'Analytics company',
  passwordHash: 'hashed', email: 'owner@example.invalid', activationCode: '123456',
  activationExpires: 1000 };

describe('TenantIdentityService', () => {
  it('creates analytics identity without PBX callback, context, AMI or ARI dependency', async () => {
    const f = fixture();
    expect(await f.service.create(input, 'analytics')).toEqual({ user: f.user, tenant: f.tenant });
    expect(f.users.create).toHaveBeenCalledWith(expect.objectContaining({
      login: 'Analytics', vpbx_user_uid: 0, level: 1,
    }), { transaction: f.transaction });
    expect(f.user.update).toHaveBeenCalledWith({ vpbx_user_uid: 71 }, { transaction: f.transaction });
    expect(f.tenants.create).toHaveBeenCalledWith(expect.objectContaining({
      owner_user_id: 71, vpbx_user_uid: 71, max_extensions: 0, max_trunks: 0, max_queues: 0,
    }), { transaction: f.transaction });
  });

  it('provisions an independent AI tenant with no PBX limits', async () => {
    const f = fixture();
    await expect(f.service.create({ ...input, activateImmediately: true }, 'standalone-ai'))
      .resolves.toEqual({ user: f.user, tenant: f.tenant });
    expect(f.tenants.create).toHaveBeenCalledWith(expect.objectContaining({
      max_extensions: 0, max_trunks: 0, max_queues: 0,
    }), { transaction: f.transaction });
  });

  it('requires a PBX callback for PBX profile and rejects one for analytics', async () => {
    const f = fixture();
    await expect(f.service.create(input, 'pbx')).rejects.toThrow('Invalid tenant provisioning profile');
    await expect(f.service.create(input, 'analytics', async () => {}))
      .rejects.toThrow('Invalid tenant provisioning profile');
    expect(f.users.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate precheck and unique-index race without leaving a tenant', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValueOnce({ uniqueid: 4 });
    await expect(f.service.create(input, 'analytics')).rejects.toThrow('уже существует');
    f.users.create.mockRejectedValueOnce(new UniqueConstraintError({ errors: [] }));
    await expect(f.service.create(input, 'analytics')).rejects.toThrow('уже существует');
    expect(f.tenants.create).not.toHaveBeenCalled();
  });

  it('propagates tenant failure inside the transaction before committing identity', async () => {
    const f = fixture();
    f.tenants.create.mockRejectedValueOnce(new Error('tenant DDL unavailable'));
    await expect(f.service.create(input, 'analytics')).rejects.toThrow('tenant DDL unavailable');
    expect(f.sequelize.transaction).toHaveBeenCalledTimes(1);
  });
});
