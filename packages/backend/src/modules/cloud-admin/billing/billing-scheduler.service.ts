import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BillingBalance } from './models/billing-balance.model';
import { BillingBalanceService } from './billing-balance.service';
import { Tenant } from '../tenant.model';
import { TenantModule } from '../tenant-module.model';
import { ModuleRegistry } from '../module-registry.model';
import {
  isSubscriptionDue,
  listPriceRub,
  mapLegacyCycle,
  normalizeIntervalCount,
  subscriptionOperationKey,
  type TenantBillingPeriod,
} from './billing-period.util';

/**
 * BillingSchedulerService — scheduled billing jobs.
 *
 * Jobs:
 *   - Recurring subscription charges for due period snapshots (hourly)
 *   - Daily trial expiry check (every day at 01:00)
 *   - Blocking tenants with negative balance (every 6 hours)
 */
@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name);

  constructor(
    @InjectModel(BillingBalance) private readonly balanceModel: typeof BillingBalance,
    @InjectModel(Tenant)        private readonly tenantModel: typeof Tenant,
    @InjectModel(TenantModule)  private readonly tenantModuleModel: typeof TenantModule,
    @InjectModel(ModuleRegistry) private readonly moduleRegistryModel: typeof ModuleRegistry,
    private readonly balanceService: BillingBalanceService,
  ) {}

  // ─── Trial expiry ──────────────────────────────────────────────────────────

  /**
   * Every day at 01:00 — suspend tenants whose trial has expired.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkTrialExpiry(): Promise<void> {
    this.logger.log('[Scheduler] Checking trial expiry...');
    const expired = await this.tenantModel.findAll({
      where: {
        status: 'trial',
        trial_ends_at: { [Op.lt]: new Date() },
      },
    });

    for (const tenant of expired) {
      await tenant.update({ status: 'suspended' });
      this.logger.warn(`[Scheduler] Trial expired → suspended tenant #${tenant.id} (${tenant.name})`);
    }

    this.logger.log(`[Scheduler] Trial expiry check done. Suspended: ${expired.length}`);
  }

  // ─── Period subscription charge ────────────────────────────────────────────

  /**
   * Hourly — charge active tenants for subscriptions whose period has elapsed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async chargeDueSubscriptions(): Promise<void> {
    this.logger.log('[Scheduler] Due subscription charge started');

    const activeTenants = await this.tenantModel.findAll({
      where: { status: 'active' },
    });

    for (const tenant of activeTenants) {
      try {
        await this.chargeTenant(tenant);
      } catch (err: any) {
        this.logger.error(`[Scheduler] Failed to charge tenant #${tenant.id}: ${err.message}`);
      }
    }

    this.logger.log('[Scheduler] Due subscription charge complete');
  }

  /** @deprecated alias kept for callers that still use the monthly name */
  async chargeMonthlySubscriptions(): Promise<void> {
    return this.chargeDueSubscriptions();
  }

  private async chargeTenant(tenant: Tenant): Promise<void> {
    const now = new Date();
    const modules = await this.tenantModuleModel.findAll({
      where: { tenant_id: tenant.id, status: 'active' },
    });
    const registryRows = await this.moduleRegistryModel.findAll();
    const registryByCode = new Map(registryRows.map((row) => [row.code, row]));

    for (const tm of modules) {
      const registry = registryByCode.get(tm.module_code);
      const period = (tm.billing_period as TenantBillingPeriod | null)
        ?? mapLegacyCycle(tm.billing_cycle);
      if (period === 'lifetime') continue;
      const interval = normalizeIntervalCount(tm.billing_interval_count);
      if (!isSubscriptionDue(now, tm.last_billed_at, period, interval)) continue;

      const amountRub = tm.list_price_amount != null
        ? Number(tm.list_price_amount)
        : listPriceRub(registry);
      if (!Number.isFinite(amountRub) || amountRub <= 0) continue;

      await this.balanceService.charge(
        tenant.id,
        amountRub,
        0,
        `Подписка ${tm.module_code} (${period}×${interval})`,
        tm.module_code,
        'charge',
        subscriptionOperationKey(tenant.id, tm.module_code, tm.last_billed_at),
      );
      await tm.update({ last_billed_at: now });
      this.logger.log(
        `[Scheduler] Charged tenant #${tenant.id} module ${tm.module_code}: ${amountRub} RUB`,
      );
    }
  }

  // ─── Block negative balance tenants ────────────────────────────────────────

  /**
   * Every 6 hours — block active tenants whose balance has gone negative.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async blockNegativeBalanceTenants(): Promise<void> {
    this.logger.log('[Scheduler] Checking for negative balances...');

    const negativeBalances = await this.balanceModel.findAll({
      where: {
        balance_kopecks: { [Op.lt]: 0 },
        is_blocked: false,
        credit_limit_kopecks: 0,
      },
    });

    for (const balance of negativeBalances) {
      await balance.update({ is_blocked: true, blocked_at: new Date() });
      await this.tenantModel.update(
        { status: 'suspended' },
        { where: { id: balance.tenant_id, status: 'active' } },
      );
      this.logger.warn(`[Scheduler] Blocked tenant #${balance.tenant_id} (negative balance)`);
    }

    this.logger.log(`[Scheduler] Negative balance check done. Blocked: ${negativeBalances.length}`);
  }
}
