import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { BillingBalance } from './models/billing-balance.model';
import { BillingTransaction } from './models/billing-transaction.model';
import { BillingBalanceService } from './billing-balance.service';
import { BillingSchedulerService } from './billing-scheduler.service';
import { BillingAdminController, BillingTenantController } from './billing.controller';
import { BankWebhookController } from './bank-webhook.controller';
import { BankWebhookService } from './bank-webhook.service';
import { TenantModule } from '../tenant-module.model';
import { ModuleRegistry } from '../module-registry.model';
import { Tenant } from '../tenant.model';
import { CloudSettingsService } from '../cloud-settings.service';
import { CloudSetting } from '../cloud-setting.model';
// ── Accounting Providers ──────────────────────────────────────────────────────
import { AccountingProviderFactory } from './accounting/accounting-provider.factory';
import { SbisAccountingProvider } from './accounting/providers/sbis-accounting.provider';
import { NullAccountingProvider } from './accounting/providers/null-accounting.provider';
import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
    MailerModule,
    SequelizeModule.forFeature([
      BillingBalance, BillingTransaction,
      TenantModule, ModuleRegistry, Tenant,
      CloudSetting,
    ]),
  ],
  providers: [
    BillingBalanceService,
    BillingSchedulerService,
    BankWebhookService,
    CloudSettingsService,
    // Accounting strategy pattern
    SbisAccountingProvider,
    NullAccountingProvider,
    AccountingProviderFactory,
  ],
  controllers: [
    BillingAdminController,
    BillingTenantController,
    BankWebhookController,
  ],
  exports: [BillingBalanceService, AccountingProviderFactory],
})
export class BillingModule {}
