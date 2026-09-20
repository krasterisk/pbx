import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Tenant } from '../cloud-admin/tenant.model';
import { TenantModule } from '../cloud-admin/tenant-module.model';
import { isAiProductCode, type AiProductModuleCode } from '../cloud-admin/product-access-policy';
import { BillingBalanceService } from '../cloud-admin/billing/billing-balance.service';
import { purchaseChargeOperationKey } from '../cloud-admin/billing/idempotent-charge';
import {
  AiPriceRevision, AiQuotaCounter, AiSkuEntitlement, AiSkuOffer, AiSkuRevision,
  AiTrialPolicySnapshot,
} from '../ai-usage/usage.models';
import { utcMonthStart } from '../ai-usage/usage-engine';
import {
  AI_SKU_PRODUCTS, createDraftSku, emptySkuStores, publishSku, reviseSkuPrice,
  revokeSku, type TrialLimits,
} from '../ai-usage/sku-catalog';

const DEFAULT_LIMITS: TrialLimits = {
  concurrent_jobs: 2, concurrent_sessions: 2, storage_bytes: 1_000_000_000,
  audio_ms: 3_600_000, provider_tokens: 1_000_000,
};

function boom(error: unknown): never {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: string }).code) : 'sku_invalid';
  if (code === 'OFFER_NOT_RELEASED' || code === 'sku_code_invalid' || code === 'sku_price_invalid'
    || code === 'trial_limits_invalid' || code === 'trial_days_invalid' || code === 'UNKNOWN_AI_PRODUCT') {
    throw new BadRequestException({ code });
  }
  if (code === 'offer_tenant_denied' || code === 'not_entitled' || code === 'entitlement_expired') {
    throw new ForbiddenException({ code });
  }
  if (code === 'sku_exists' || code === 'ALREADY_ACTIVE' || code === 'sku_revoked') {
    throw new ConflictException({ code });
  }
  throw new BadRequestException({ code });
}

@Injectable()
export class SkuCatalogService {
  constructor(
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
    @InjectModel(TenantModule) private readonly tenantModules: typeof TenantModule,
    @InjectModel(AiTrialPolicySnapshot) private readonly snapshots: typeof AiTrialPolicySnapshot,
    @InjectModel(AiSkuRevision) private readonly revisions: typeof AiSkuRevision,
    @InjectModel(AiSkuOffer) private readonly offers: typeof AiSkuOffer,
    @InjectModel(AiSkuEntitlement) private readonly entitlements: typeof AiSkuEntitlement,
    @InjectModel(AiQuotaCounter) private readonly quotas: typeof AiQuotaCounter,
    @InjectModel(AiPriceRevision) private readonly prices: typeof AiPriceRevision,
    private readonly billing: BillingBalanceService,
    private readonly sequelize: Sequelize,
  ) {}

  async listPublished(viewerUid: number) {
    const rows = await this.offers.findAll({
      where: { owner_tenant_uid: viewerUid, status: 'published' },
    });
    if (rows.length === 0) return [];
    const revisions = await this.revisions.findAll({
      where: { id: rows.map((row) => row.current_revision_id) },
    });
    const byId = new Map(revisions.map((row) => [row.id, row]));
    return rows.map((offer) => {
      const revision = byId.get(offer.current_revision_id);
      return {
        skuCode: offer.sku_code,
        product: offer.product,
        status: offer.status,
        revision: revision?.revision ?? 1,
        priceMonthlyMinor: Number(revision?.price_monthly_minor ?? 0),
        currency: revision?.currency ?? null,
        trialDays: revision?.trial_days ?? 0,
        moneyPolicy: revision?.money_policy ?? 'shadow',
      };
    }).filter((row) => row.skuCode);
  }

  async createDraft(input: {
    ownerTenantUid: number;
    skuCode: string;
    product: AiProductModuleCode;
    moneyPolicy: 'shadow' | 'local_byok';
    priceMonthlyMinor: number;
    currency: string | null;
    trialDays: number;
    limits?: TrialLimits;
    now?: Date;
  }) {
    if (!isAiProductCode(input.product) || !AI_SKU_PRODUCTS.includes(input.product)) {
      throw new BadRequestException({ code: 'UNKNOWN_AI_PRODUCT' });
    }
    if (input.moneyPolicy !== 'shadow' && input.moneyPolicy !== 'local_byok') {
      throw new BadRequestException({ code: 'sku_money_policy_invalid' });
    }
    const now = input.now ?? new Date();
    const stores = emptySkuStores();
    let created;
    try {
      created = createDraftSku(stores, {
        ...input, product: input.product, limits: input.limits ?? DEFAULT_LIMITS, now,
      });
    } catch (error) { boom(error); }
    return this.sequelize.transaction(async (t) => {
      const snapshot = [...stores.snapshots.values()][0];
      await this.snapshots.create({
        id: snapshot.id, digest: snapshot.digest,
        concurrent_jobs: String(snapshot.limits.concurrent_jobs),
        concurrent_sessions: String(snapshot.limits.concurrent_sessions),
        storage_bytes: String(snapshot.limits.storage_bytes),
        audio_ms: String(snapshot.limits.audio_ms),
        provider_tokens: String(snapshot.limits.provider_tokens),
        payload_json: snapshot.payload, created_at: now,
      } as any, { transaction: t });
      const price = [...stores.prices.values()][0];
      if (price) {
        await this.prices.create({
          id: price.id, provider_uid: price.providerUid, product: price.product,
          unit: price.unit, currency: price.currency, rate: price.rate, scale: price.scale,
          rounding_mode: price.roundingMode, money_policy: price.moneyPolicy,
          effective_at: now, config_digest: price.configDigest, created_at: now,
        } as any, { transaction: t });
      }
      await this.revisions.create({
        id: created.id, owner_tenant_uid: created.ownerTenantUid, sku_code: created.skuCode,
        revision: created.revision, product: created.product, money_policy: created.moneyPolicy,
        price_monthly_minor: String(created.priceMonthlyMinor), currency: created.currency,
        trial_days: created.trialDays, policy_snapshot_id: created.policySnapshotId,
        usage_price_revision_id: created.usagePriceRevisionId, config_digest: created.configDigest,
        created_at: now,
      } as any, { transaction: t });
      await this.offers.create({
        owner_tenant_uid: created.ownerTenantUid, sku_code: created.skuCode,
        product: created.product, status: 'draft', current_revision_id: created.id,
        updated_at: now,
      } as any, { transaction: t });
      return { skuCode: created.skuCode, revision: created.revision, status: 'draft' as const };
    }).catch((error) => {
      if (error instanceof UniqueConstraintError) throw new ConflictException({ code: 'sku_exists' });
      throw error;
    });
  }

  async setStatus(ownerTenantUid: number, skuCode: string, status: 'published' | 'revoked', now = new Date()) {
    return this.sequelize.transaction(async (t) => {
      const offer = await this.offers.findOne({
        where: { owner_tenant_uid: ownerTenantUid, sku_code: skuCode },
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!offer) throw new BadRequestException({ code: 'sku_not_found' });
      const stores = emptySkuStores();
      stores.offers.set(`${ownerTenantUid}:${skuCode}`, {
        ownerTenantUid, skuCode, product: offer.product as 'speech_analytics',
        status: offer.status as 'draft', currentRevisionId: offer.current_revision_id,
      });
      try {
        if (status === 'published') publishSku(stores, ownerTenantUid, skuCode);
        else revokeSku(stores, ownerTenantUid, skuCode);
      } catch (error) { boom(error); }
      await offer.update({ status, updated_at: now }, { transaction: t });
      return { skuCode, status };
    });
  }

  async revise(input: {
    ownerTenantUid: number; skuCode: string; priceMonthlyMinor: number;
    currency: string | null; trialDays: number; limits?: TrialLimits; now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.sequelize.transaction(async (t) => {
      const offer = await this.offers.findOne({
        where: { owner_tenant_uid: input.ownerTenantUid, sku_code: input.skuCode },
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!offer) throw new BadRequestException({ code: 'sku_not_found' });
      const current = await this.revisions.findByPk(offer.current_revision_id, { transaction: t });
      if (!current) throw new BadRequestException({ code: 'sku_revision_missing' });
      const snapshotRow = await this.snapshots.findByPk(current.policy_snapshot_id, { transaction: t });
      const stores = emptySkuStores();
      if (snapshotRow) {
        stores.snapshots.set(snapshotRow.id, {
          id: snapshotRow.id, digest: snapshotRow.digest, payload: snapshotRow.payload_json,
          limits: {
            concurrent_jobs: Number(snapshotRow.concurrent_jobs),
            concurrent_sessions: Number(snapshotRow.concurrent_sessions),
            storage_bytes: Number(snapshotRow.storage_bytes),
            audio_ms: Number(snapshotRow.audio_ms),
            provider_tokens: Number(snapshotRow.provider_tokens),
          },
        });
      }
      stores.revisions.set(current.id, {
        id: current.id, ownerTenantUid: current.owner_tenant_uid, skuCode: current.sku_code,
        revision: current.revision, product: current.product as 'speech_analytics',
        moneyPolicy: current.money_policy as 'shadow', priceMonthlyMinor: Number(current.price_monthly_minor),
        currency: current.currency, trialDays: current.trial_days,
        policySnapshotId: current.policy_snapshot_id,
        usagePriceRevisionId: current.usage_price_revision_id, configDigest: current.config_digest,
      });
      stores.offers.set(`${input.ownerTenantUid}:${input.skuCode}`, {
        ownerTenantUid: input.ownerTenantUid, skuCode: input.skuCode,
        product: offer.product as 'speech_analytics', status: offer.status as 'draft',
        currentRevisionId: current.id,
      });
      let next;
      try {
        next = reviseSkuPrice(stores, {
          ownerTenantUid: input.ownerTenantUid, skuCode: input.skuCode,
          priceMonthlyMinor: input.priceMonthlyMinor, currency: input.currency,
          trialDays: input.trialDays, limits: input.limits ?? DEFAULT_LIMITS,
        });
      } catch (error) { boom(error); }
      const snapshot = stores.snapshots.get(next.policySnapshotId)!;
      await this.snapshots.create({
        id: snapshot.id, digest: snapshot.digest,
        concurrent_jobs: String(snapshot.limits.concurrent_jobs),
        concurrent_sessions: String(snapshot.limits.concurrent_sessions),
        storage_bytes: String(snapshot.limits.storage_bytes),
        audio_ms: String(snapshot.limits.audio_ms),
        provider_tokens: String(snapshot.limits.provider_tokens),
        payload_json: snapshot.payload, created_at: now,
      } as any, { transaction: t });
      await this.revisions.create({
        id: next.id, owner_tenant_uid: next.ownerTenantUid, sku_code: next.skuCode,
        revision: next.revision, product: next.product, money_policy: next.moneyPolicy,
        price_monthly_minor: String(next.priceMonthlyMinor), currency: next.currency,
        trial_days: next.trialDays, policy_snapshot_id: next.policySnapshotId,
        usage_price_revision_id: next.usagePriceRevisionId, config_digest: next.configDigest,
        created_at: now,
      } as any, { transaction: t });
      await offer.update({ current_revision_id: next.id, updated_at: now }, { transaction: t });
      return { skuCode: next.skuCode, revision: next.revision };
    });
  }

  async purchase(buyerUid: number, skuCode: string, actorUserId: number, now = new Date()) {
    const preview = await this.sequelize.transaction(async (t) => {
      const tenant = await this.tenants.findOne({
        where: { vpbx_user_uid: buyerUid }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!tenant) throw new ForbiddenException({ code: 'tenant_not_found' });
      const offer = await this.offers.findOne({
        where: { owner_tenant_uid: buyerUid, sku_code: skuCode },
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!offer || offer.status !== 'published') {
        throw new BadRequestException({ code: 'OFFER_NOT_RELEASED' });
      }
      const revision = await this.revisions.findByPk(offer.current_revision_id, {
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!revision) throw new BadRequestException({ code: 'sku_revision_missing' });
      const existing = await this.entitlements.findOne({
        where: { tenant_uid: buyerUid, product: revision.product },
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (existing) throw new ConflictException({ code: 'ALREADY_ACTIVE' });
      return { tenant, revision };
    });
    const amountRub = Number(preview.revision.price_monthly_minor) / 100;
    let charged = false;
    if (preview.revision.money_policy !== 'local_byok' && amountRub > 0) {
      await this.billing.charge(
        preview.tenant.id, amountRub, actorUserId, `Purchase SKU ${skuCode}`,
        preview.revision.product, 'charge',
        purchaseChargeOperationKey(preview.tenant.id, `sku:${skuCode}`),
      );
      charged = true;
    }
    try {
      return await this.sequelize.transaction(async (t) => {
        const offer = await this.offers.findOne({
          where: { owner_tenant_uid: buyerUid, sku_code: skuCode },
          transaction: t, lock: t.LOCK.UPDATE,
        });
        if (!offer || offer.status !== 'published'
          || offer.current_revision_id !== preview.revision.id) {
          throw new BadRequestException({ code: 'OFFER_NOT_RELEASED' });
        }
        const snapshot = await this.snapshots.findByPk(preview.revision.policy_snapshot_id, { transaction: t });
        if (!snapshot) throw new BadRequestException({ code: 'trial_policy_missing' });
        const trialEndsAt = preview.revision.trial_days > 0
          ? new Date(now.getTime() + preview.revision.trial_days * 86400000) : null;
        await this.entitlements.create({
          tenant_uid: buyerUid, product: preview.revision.product,
          sku_revision_id: preview.revision.id,
          status: preview.revision.trial_days > 0 ? 'trial' : 'active',
          trial_ends_at: trialEndsAt, policy_digest: snapshot.digest, purchased_at: now,
        } as any, { transaction: t });
        const periodStart = new Date(utcMonthStart(now));
        const limits = {
          concurrent_jobs: snapshot.concurrent_jobs, concurrent_sessions: snapshot.concurrent_sessions,
          storage_bytes: snapshot.storage_bytes, audio_ms: snapshot.audio_ms,
          provider_tokens: snapshot.provider_tokens,
        };
        await this.quotas.bulkCreate((['concurrent_jobs', 'concurrent_sessions', 'storage_bytes', 'audio_ms', 'provider_tokens'] as const).map((metric) => ({
          tenant_uid: buyerUid, product: preview.revision.product, metric, period_start: periodStart,
          limit_units: String(limits[metric]), used_units: '0', reserved_units: '0',
          revision: 1, updated_at: now,
        })) as any[], { transaction: t, ignoreDuplicates: true });
        await this.tenantModules.upsert({
          tenant_id: preview.tenant.id, module_code: preview.revision.product,
          status: preview.revision.trial_days > 0 ? 'trial' : 'active',
          activated_at: now, expires_at: trialEndsAt,
        } as any, { transaction: t });
        return {
          skuCode, product: preview.revision.product, amountRub,
          entitled: true, enabled: false,
        };
      });
    } catch (error) {
      if (charged && amountRub > 0) {
        try {
          await this.billing.deposit(
            preview.tenant.id, amountRub, actorUserId, `Refund compensate SKU ${skuCode}`,
          );
        } catch { /* compensate is best-effort; original error is rethrown */ }
      }
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({ code: 'ALREADY_ACTIVE' });
      }
      throw error;
    }
  }
}
