import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PsEndpoint } from './ps-endpoint.model';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { blfContext, blfSettings, buildBlfHints } from './blf-policy';

/** Owns only krasterisk/routes/blf_{tenant}.conf; contexts contain no call routing. */
@Injectable()
export class BlfService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BlfService.name);
  private readonly tails = new Map<number, Promise<boolean>>();
  private readonly applied = new Map<number, string>();
  private timer?: ReturnType<typeof setInterval>;
  private reconciling = false;

  constructor(
    @InjectModel(PsEndpoint) private readonly endpoints: typeof PsEndpoint,
    private readonly dialplan: DialplanApplyService,
  ) {}

  onApplicationBootstrap() {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const rows = await this.endpoints.findAll({ attributes: ['id', 'tenantid'] });
      const tenants = new Set(rows.filter((r) => /^ew?.+_\d+$/.test(r.id)).map((r) => Number(r.tenantid)));
      // Include previously seen tenants so deleting the final subscriber clears its context.
      for (const tenant of this.applied.keys()) tenants.add(tenant);
      for (const tenant of tenants) if (Number.isSafeInteger(tenant) && tenant >= 0) await this.sync(tenant);
    } catch (e) {
      this.logger.warn(`BLF reconciliation pending: ${e instanceof Error ? e.message : String(e)}`);
    } finally { this.reconciling = false; }
  }

  /** Serialize writes per tenant; failed applies are retried by the reconciliation loop. */
  sync(tenant: number): Promise<boolean> {
    const next = (this.tails.get(tenant) || Promise.resolve(true)).then(() => this.apply(tenant));
    this.tails.set(tenant, next);
    void next.finally(() => { if (this.tails.get(tenant) === next) this.tails.delete(tenant); });
    return next;
  }

  private async apply(tenant: number): Promise<boolean> {
    try {
      const context = blfContext(tenant);
      const rows = await this.endpoints.findAll({ where: { tenantid: String(tenant) } });
      const ids = rows.map((r) => r.id);
      const lines = buildBlfHints(ids, tenant);
      // Managed subscription lookup always belongs to the authenticated tenant.
      for (const row of rows) {
        if (!/^ew?.+_\d+$/.test(row.id) || !row.id.endsWith(`_${tenant}`)) continue;
        const policy = blfSettings(row.allow_subscribe, tenant);
        if (row.subscribe_context !== context || row.allow_subscribe !== policy.allow_subscribe) {
          await row.update(policy);
        }
      }
      const signature = JSON.stringify(lines);
      if (this.applied.get(tenant) !== signature) {
        const result = await this.dialplan.applyCategories(`krasterisk/routes/blf_${tenant}.conf`, [{ name: context, lines }]);
        if (!result.success) throw new Error('Dialplan apply was not successful');
        this.applied.set(tenant, signature);
      }
      return true;
    } catch (e) {
      this.logger.warn(`BLF tenant ${tenant} apply pending: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
}
