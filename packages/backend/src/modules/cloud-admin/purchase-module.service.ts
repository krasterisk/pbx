import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * Tenant module purchase — charge balance then activate (NAV-07 / D-23).
 *
 * Wave 0 stub (plan 08-13): public API + NotImplementedException.
 * Full implementation (charge → activateModule): plan 08-06.
 *
 * Do not invent card processors — use BillingBalanceService.charge (D-23).
 */
@Injectable()
export class PurchaseModuleService {
  /**
   * Purchase and activate a paid module for a tenant.
   *
   * @param tenantId - tenant receiving the module
   * @param moduleCode - catalog module code
   * @param actorUserId - authenticated user performing the purchase
   */
  async purchase(
    _tenantId: number,
    _moduleCode: string,
    _actorUserId: number,
  ): Promise<void> {
    // 08-06: validate price → BillingBalanceService.charge → ModulesRegistryService.activateModule
    throw new NotImplementedException(
      'PurchaseModuleService.purchase — implement in plan 08-06 (charge then activateModule)',
    );
  }
}
