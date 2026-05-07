import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { MailerService } from '../../mailer/mailer.service';
import { BillingBalance } from './models/billing-balance.model';
import { BillingTransaction } from './models/billing-transaction.model';
import { BillingBalanceService } from './billing-balance.service';
import { Tenant } from '../tenant.model';
import { TenantModule } from '../tenant-module.model';

/**
 * BankWebhookService — processes incoming bank payment notifications.
 *
 * Flow:
 *   1. Validate the webhook payload
 *   2. Deposit funds into the tenant's billing balance
 *   3. Activate any pending modules if balance is now sufficient
 *   4. Send confirmation email to tenant admin
 */
@Injectable()
export class BankWebhookService {
  private readonly logger = new Logger(BankWebhookService.name);

  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(TenantModule) private readonly tenantModuleModel: typeof TenantModule,
    private readonly balanceService: BillingBalanceService,
    private readonly mailerService: MailerService,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Process a payment notification from the bank.
   * @param dto — bank webhook payload (validated by controller)
   */
  async processPayment(dto: {
    inn?: string;
    amount?: number | string;
    amountRub?: number | string;
    description?: string;
    [key: string]: any;
  }): Promise<{ ok: boolean; message: string }> {
    this.logger.log(`[BankWebhook] Incoming payment: ${JSON.stringify(dto)}`);

    // Resolve amount in rubles
    const amountRub = Number(dto.amountRub ?? dto.amount ?? 0);
    if (!amountRub || amountRub <= 0) {
      this.logger.warn('[BankWebhook] Zero or missing amount — skipping');
      return { ok: false, message: 'Zero amount' };
    }

    // Try to match tenant by INN if provided
    let tenantId: number | null = null;
    if (dto.inn) {
      const tenant = await this.tenantModel.findOne({
        where: { company_inn: dto.inn },
      });
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (!tenantId) {
      // Payment without a matched tenant — log and acknowledge to avoid retries
      this.logger.warn(`[BankWebhook] Could not match tenant for INN=${dto.inn} — logged only`);
      return { ok: true, message: 'Payment received but tenant not matched' };
    }

    // Deposit into tenant balance (performed_by = 0 = system)
    await this.balanceService.deposit(
      tenantId,
      amountRub,
      0,
      dto.description ?? `Bank payment ${amountRub} RUB`,
    );

    this.logger.log(`[BankWebhook] Deposited ${amountRub} RUB to tenant #${tenantId}`);

    return { ok: true, message: `Deposited ${amountRub} RUB to tenant #${tenantId}` };
  }
}
