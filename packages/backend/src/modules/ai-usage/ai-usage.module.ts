import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiPriceRevision, AiQuotaCounter, AiSkuEntitlement, AiSkuOffer, AiSkuRevision,
  AiTrialPolicySnapshot, AiUsageEvent, AiUsageLedger, AiUsageReservation,
} from './usage.models';

/** Usage journal, SKU catalog and settlement. Live BillingBalanceService.charge is opt-in via COM2 flags, not registered here. */
@Module({
  imports: [SequelizeModule.forFeature([
    AiQuotaCounter, AiPriceRevision, AiUsageReservation, AiUsageEvent, AiUsageLedger,
    AiTrialPolicySnapshot, AiSkuRevision, AiSkuOffer, AiSkuEntitlement,
  ])],
  exports: [SequelizeModule],
})
export class AiUsageModule {}
