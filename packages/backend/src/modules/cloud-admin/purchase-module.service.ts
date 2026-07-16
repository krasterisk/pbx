import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BillingBalanceService } from './billing/billing-balance.service';
import { ModulesRegistryService } from './modules-registry.service';

export interface PurchaseResult {
  moduleCode: string;
  moduleName: string;
  amountRub: number;
}

/**
 * Tenant module purchase — server-side price → charge balance → activate (NAV-07 / D-23).
 * No PCI / card processor — internal ledger only.
 */
@Injectable()
export class PurchaseModuleService {
  private readonly logger = new Logger(PurchaseModuleService.name);

  constructor(
    private readonly billing: BillingBalanceService,
    private readonly modules: ModulesRegistryService,
  ) {}

  /**
   * Purchase and activate a module for a tenant.
   * Amount is always resolved server-side — never trust client price/paid flags.
   */
  async purchase(
    tenantId: number,
    moduleCode: string,
    actorUserId: number,
  ): Promise<PurchaseResult> {
    const offer = await this.modules.resolvePurchaseOffer(moduleCode);
    const alreadyActive = await this.modules.isModuleActiveForTenant(tenantId, offer.code);
    if (alreadyActive) {
      throw new BadRequestException({
        code: 'ALREADY_ACTIVE',
        message: `Module ${offer.code} is already active`,
      });
    }

    const amountRub = offer.priceRub;

    if (amountRub > 0) {
      const balance = await this.billing.getBalance(tenantId);
      const available =
        Number(balance.balance_kopecks) + Number(balance.credit_limit_kopecks);
      const needed = Math.round(amountRub * 100);
      if (available < needed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            code: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient balance to purchase module',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      await this.billing.charge(
        tenantId,
        amountRub,
        actorUserId,
        `Purchase module ${offer.code}`,
        offer.code,
      );
    }

    try {
      await this.modules.activateModule(tenantId, offer.code);
    } catch (err) {
      if (amountRub > 0) {
        this.logger.error(
          `activateModule failed after charge for tenant #${tenantId} module ${offer.code}: ${(err as Error).message}`,
        );
        try {
          await this.billing.deposit(
            tenantId,
            amountRub,
            actorUserId,
            `Refund compensate purchase ${offer.code}`,
          );
        } catch (compensateErr) {
          this.logger.error(
            `Failed to compensate charge for tenant #${tenantId} module ${offer.code}: ${(compensateErr as Error).message}`,
          );
        }
      }
      throw err;
    }

    return {
      moduleCode: offer.code,
      moduleName: offer.name,
      amountRub,
    };
  }
}
