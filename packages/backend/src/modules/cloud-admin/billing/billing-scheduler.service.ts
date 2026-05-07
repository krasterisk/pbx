import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BillingBalance } from './models/billing-balance.model';
import { BillingBalanceService } from './billing-balance.service';
import { Tenant } from '../tenant.model';
import { TenantModule } from '../tenant-module.model';
import { ModuleRegistry } from '../module-registry.model';

/**
 * BillingSchedulerService — scheduled billing jobs.
 *
 * Jobs:
 *   - Monthly subscription charges (1st of each month at 03:00)
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

  // ─── Monthly subscription charge ───────────────────────────────────────────

  /**
   * 1st of each month at 03:00 — charge active tenants for enabled modules.
   */
  @Cron('0 3 1 * *')
  async chargeMonthlySubscriptions(): Promise<void> {
    this.logger.log('[Scheduler] Monthly subscription charge started');

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

    this.logger.log('[Scheduler] Monthly subscription charge complete');
  }

  private async chargeTenant(tenant: Tenant): Promise<void> {
    // Get all enabled paid modules for this tenant
    const modules = await this.tenantModuleModel.findAll({
      where: { tenant_id: tenant.id, status: 'active' },
      include: [{ model: this.moduleRegistryModel, as: 'module' }],
    });

    let totalKopecks = 0;
    const descriptions: string[] = [];

    for (const tm of modules) {
      const registry = (tm as any).module as ModuleRegistry | undefined;
      if (!registry || !registry.price_monthly || Number(registry.price_monthly) === 0) continue;
      totalKopecks += Math.round(Number(registry.price_monthly) * 100);
      descriptions.push(`${registry.name}: ${Number(registry.price_monthly)} руб.`);
    }

    if (totalKopecks === 0) return;

    const amountRub = totalKopecks / 100;
    await this.balanceService.charge(
      tenant.id,
      amountRub,
      0, // performed_by = system
      `Ежемесячная подписка: ${descriptions.join(', ')}`,
      undefined,
      'charge',
    );

    this.logger.log(`[Scheduler] Charged tenant #${tenant.id} (${tenant.name}): ${amountRub} RUB`);
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
