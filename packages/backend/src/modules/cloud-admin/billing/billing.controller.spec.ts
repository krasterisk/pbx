import { BillingTenantController } from './billing.controller';
import { BillingBalanceService } from './billing-balance.service';
import { Tenant } from '../tenant.model';

describe('tenant billing identity', () => {
  const billing = { getBalance: jest.fn(), getTransactions: jest.fn() };
  const tenants = { findOne: jest.fn() };
  let controller: BillingTenantController;
  beforeEach(() => {
    jest.clearAllMocks();
    tenants.findOne.mockResolvedValue({ id: 7 });
    controller = new BillingTenantController(billing as unknown as BillingBalanceService, tenants as unknown as typeof Tenant);
  });
  it('looks up the cabinet id rather than passing PBX owner uid as balance id', async () => {
    await controller.getMyBalance({ user: { vpbx_user_uid: 42 } });
    expect(tenants.findOne).toHaveBeenCalledWith({ where: { vpbx_user_uid: 42 }, attributes: ['id'] });
    expect(billing.getBalance).toHaveBeenCalledWith(7);
  });
  it('uses the same binding for transactions and bounds pagination', async () => {
    await controller.getMyTransactions({ user: { vpbx_user_uid: 42 } }, '10000', '-5');
    expect(billing.getTransactions).toHaveBeenCalledWith(7, 100, 0);
  });
  it('does not invent a balance partition for an unbound organization', async () => {
    tenants.findOne.mockResolvedValue(null);
    await expect(controller.getMyBalance({ user: { vpbx_user_uid: 42 } })).rejects.toThrow('not configured');
    expect(billing.getBalance).not.toHaveBeenCalled();
  });
});
