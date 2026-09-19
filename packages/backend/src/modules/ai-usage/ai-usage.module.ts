import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiPriceRevision, AiQuotaCounter, AiUsageEvent, AiUsageLedger, AiUsageReservation,
} from './usage.models';

/** Usage journal and shadow settlement. Does not call BillingBalanceService.charge. Not in AppModule HTTP. */
@Module({
  imports: [SequelizeModule.forFeature([
    AiQuotaCounter, AiPriceRevision, AiUsageReservation, AiUsageEvent, AiUsageLedger,
  ])],
  exports: [SequelizeModule],
})
export class AiUsageModule {}
