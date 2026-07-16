import { NotImplementedException } from '@nestjs/common';
import { PurchaseModuleService } from './purchase-module.service';

/**
 * Wave 0 Nyquist gate for NAV-07 / D-23.
 *
 * GREEN NotImplemented stub in plan 08-13.
 * Owning plan for full charge-then-activate behavior: 08-06.
 *
 * Contract (must hold when 08-06 replaces the stub):
 * - insufficient balance → throw (never activate)
 * - success → BillingBalanceService.charge then ModulesRegistryService.activateModule
 * - never trust a client "paid" flag
 */
describe('PurchaseModuleService', () => {
  let service: PurchaseModuleService;

  beforeEach(() => {
    service = new PurchaseModuleService();
  });

  it('exposes purchase(tenantId, moduleCode, actorUserId)', () => {
    expect(typeof service.purchase).toBe('function');
  });

  it('Wave 0 stub throws NotImplementedException (full impl: 08-06)', async () => {
    await expect(service.purchase(1, 'voice_robot', 42)).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  describe('charge-then-activate contract (owned by 08-06)', () => {
    it.todo('throws when tenant balance is insufficient — never calls activateModule');
    it.todo('on success calls charge then activateModule in that order');
  });
});
