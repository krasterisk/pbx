import { createHash, randomUUID } from 'node:crypto';
import {
  AI_USAGE_METRICS, insertPrice, seedQuota, utcMonthStart, type AiUsageMetric,
  type MoneyPolicy, type PriceRow, type QuotaRow,
} from './usage-engine';
import { disabledWallet, type WalletProbe } from './shadow-settlement';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const AI_SKU_PRODUCTS = ['speech_analytics', 'ai_voice_robots'] as const;
export type AiSkuProduct = (typeof AI_SKU_PRODUCTS)[number];
export type SkuOfferStatus = 'draft' | 'published' | 'revoked';
export type SkuEntitlementStatus = 'trial' | 'active' | 'expired';

export type TrialLimits = Record<AiUsageMetric, number>;

export type PolicySnapshot = {
  id: string;
  digest: string;
  limits: TrialLimits;
  payload: string;
};

export type SkuRevision = {
  id: string;
  ownerTenantUid: number;
  skuCode: string;
  revision: number;
  product: AiSkuProduct;
  moneyPolicy: MoneyPolicy;
  priceMonthlyMinor: number;
  currency: string | null;
  trialDays: number;
  policySnapshotId: string;
  usagePriceRevisionId: string | null;
  configDigest: string;
};

export type SkuOffer = {
  ownerTenantUid: number;
  skuCode: string;
  product: AiSkuProduct;
  status: SkuOfferStatus;
  currentRevisionId: string;
};

export type SkuEntitlement = {
  tenantUid: number;
  product: AiSkuProduct;
  skuRevisionId: string;
  status: SkuEntitlementStatus;
  trialEndsAt: number | null;
  policyDigest: string;
};

export type SkuStores = {
  snapshots: Map<string, PolicySnapshot>;
  revisions: Map<string, SkuRevision>;
  offers: Map<string, SkuOffer>;
  entitlements: Map<string, SkuEntitlement>;
  quotas: Map<string, QuotaRow>;
  prices: Map<string, PriceRow>;
  activations: Map<string, boolean>;
};

export function emptySkuStores(): SkuStores {
  return {
    snapshots: new Map(), revisions: new Map(), offers: new Map(),
    entitlements: new Map(), quotas: new Map(), prices: new Map(),
    activations: new Map(),
  };
}

export function offerKey(ownerTenantUid: number, skuCode: string): string {
  return `${ownerTenantUid}:${skuCode}`;
}

export function entitlementKey(tenantUid: number, product: string): string {
  return `${tenantUid}:${product}`;
}

export function activationKey(tenantUid: number, product: string): string {
  return `${tenantUid}:${product}`;
}

function fail(code: string): never {
  throw Object.assign(new Error(code), { code });
}

function assertProduct(product: string): asserts product is AiSkuProduct {
  if (!AI_SKU_PRODUCTS.includes(product as AiSkuProduct)) fail('UNKNOWN_AI_PRODUCT');
}

function assertLimits(limits: TrialLimits): void {
  for (const metric of AI_USAGE_METRICS) {
    const value = limits[metric];
    if (!Number.isInteger(value) || value < 0) fail('trial_limits_invalid');
  }
}

export function policySnapshotOf(limits: TrialLimits): Omit<PolicySnapshot, 'id'> {
  assertLimits(limits);
  const payload = canonicalJson(limits);
  return { digest: createHash('sha256').update(payload).digest('hex'), limits, payload };
}

export function listPublishedSkus(stores: SkuStores, viewerUid: number): SkuRevision[] {
  return [...stores.offers.values()]
    .filter((offer) => offer.ownerTenantUid === viewerUid && offer.status === 'published')
    .map((offer) => {
      const revision = stores.revisions.get(offer.currentRevisionId);
      if (!revision) fail('sku_revision_missing');
      return revision;
    });
}

export function createDraftSku(stores: SkuStores, input: {
  ownerTenantUid: number;
  skuCode: string;
  product: AiSkuProduct;
  moneyPolicy: MoneyPolicy;
  priceMonthlyMinor: number;
  currency: string | null;
  trialDays: number;
  limits: TrialLimits;
  usagePrice?: Omit<PriceRow, 'id' | 'product' | 'moneyPolicy'>;
  now: Date;
}): SkuRevision {
  assertProduct(input.product);
  if (!Number.isSafeInteger(input.ownerTenantUid) || input.ownerTenantUid < 0) fail('tenant_invalid');
  if (input.moneyPolicy === 'cloud_wallet') fail('sku_money_policy_invalid');
  if (!/^[a-z0-9_]{3,64}$/.test(input.skuCode)) fail('sku_code_invalid');
  if (!Number.isInteger(input.priceMonthlyMinor) || input.priceMonthlyMinor < 0) fail('sku_price_invalid');
  if (!Number.isInteger(input.trialDays) || input.trialDays < 0) fail('trial_days_invalid');
  if (stores.offers.has(offerKey(input.ownerTenantUid, input.skuCode))) fail('sku_exists');
  if (input.moneyPolicy === 'local_byok' && input.usagePrice?.rate != null) fail('price_unknown_zero');
  const snapshot: PolicySnapshot = { id: randomUUID(), ...policySnapshotOf(input.limits) };
  stores.snapshots.set(snapshot.id, snapshot);
  let usagePriceRevisionId: string | null = null;
  if (input.usagePrice) {
    const price = insertPrice({
      quotas: stores.quotas, reservations: new Map(), events: new Map(),
      ledger: [], prices: stores.prices,
    }, {
      ...input.usagePrice,
      id: randomUUID(),
      product: input.product,
      moneyPolicy: input.moneyPolicy,
    });
    usagePriceRevisionId = price.id;
  } else if (input.moneyPolicy === 'local_byok') {
    const price = insertPrice({
      quotas: stores.quotas, reservations: new Map(), events: new Map(),
      ledger: [], prices: stores.prices,
    }, {
      id: randomUUID(),
      providerUid: 'local-byok',
      product: input.product,
      unit: 'audio_ms',
      currency: null,
      rate: null,
      scale: 2,
      roundingMode: 'half_up',
      moneyPolicy: 'local_byok',
      configDigest: snapshot.digest,
    });
    usagePriceRevisionId = price.id;
  }
  const revision: SkuRevision = {
    id: randomUUID(),
    ownerTenantUid: input.ownerTenantUid,
    skuCode: input.skuCode,
    revision: 1,
    product: input.product,
    moneyPolicy: input.moneyPolicy,
    priceMonthlyMinor: input.priceMonthlyMinor,
    currency: input.currency,
    trialDays: input.trialDays,
    policySnapshotId: snapshot.id,
    usagePriceRevisionId,
    configDigest: snapshot.digest,
  };
  stores.revisions.set(revision.id, revision);
  stores.offers.set(offerKey(input.ownerTenantUid, input.skuCode), {
    ownerTenantUid: input.ownerTenantUid,
    skuCode: input.skuCode,
    product: input.product,
    status: 'draft',
    currentRevisionId: revision.id,
  });
  return revision;
}

export function reviseSkuPrice(stores: SkuStores, input: {
  ownerTenantUid: number;
  skuCode: string;
  priceMonthlyMinor: number;
  currency: string | null;
  trialDays: number;
  limits: TrialLimits;
  moneyPolicy?: MoneyPolicy;
}): SkuRevision {
  const offer = stores.offers.get(offerKey(input.ownerTenantUid, input.skuCode));
  if (!offer) fail('sku_not_found');
  const current = stores.revisions.get(offer.currentRevisionId);
  if (!current) fail('sku_revision_missing');
  if (!Number.isInteger(input.priceMonthlyMinor) || input.priceMonthlyMinor < 0) fail('sku_price_invalid');
  const snapshot: PolicySnapshot = { id: randomUUID(), ...policySnapshotOf(input.limits) };
  stores.snapshots.set(snapshot.id, snapshot);
  const revision: SkuRevision = {
    ...current,
    id: randomUUID(),
    revision: current.revision + 1,
    priceMonthlyMinor: input.priceMonthlyMinor,
    currency: input.currency,
    trialDays: input.trialDays,
    moneyPolicy: input.moneyPolicy ?? current.moneyPolicy,
    policySnapshotId: snapshot.id,
    configDigest: snapshot.digest,
  };
  stores.revisions.set(revision.id, revision);
  offer.currentRevisionId = revision.id;
  return revision;
}

export function publishSku(stores: SkuStores, ownerTenantUid: number, skuCode: string): SkuOffer {
  const offer = stores.offers.get(offerKey(ownerTenantUid, skuCode));
  if (!offer) fail('sku_not_found');
  if (offer.status === 'revoked') fail('sku_revoked');
  offer.status = 'published';
  return offer;
}

export function revokeSku(stores: SkuStores, ownerTenantUid: number, skuCode: string): SkuOffer {
  const offer = stores.offers.get(offerKey(ownerTenantUid, skuCode));
  if (!offer) fail('sku_not_found');
  offer.status = 'revoked';
  return offer;
}

export function purchaseSku(stores: SkuStores, input: {
  buyerUid: number;
  ownerTenantUid: number;
  skuCode: string;
  now: Date;
  wallet?: WalletProbe;
}): SkuEntitlement {
  const offer = stores.offers.get(offerKey(input.ownerTenantUid, input.skuCode));
  if (!offer) fail('OFFER_NOT_RELEASED');
  if (offer.ownerTenantUid !== input.buyerUid) fail('offer_tenant_denied');
  if (offer.status !== 'published') fail('OFFER_NOT_RELEASED');
  const revision = stores.revisions.get(offer.currentRevisionId);
  if (!revision) fail('sku_revision_missing');
  const existing = stores.entitlements.get(entitlementKey(input.buyerUid, revision.product));
  if (existing) fail('ALREADY_ACTIVE');
  const wallet = input.wallet ?? disabledWallet();
  if (revision.moneyPolicy === 'local_byok') {
    if (wallet.chargeCalls !== 0 || wallet.lookupCalls !== 0) fail('byok_wallet_forbidden');
  } else if (revision.priceMonthlyMinor > 0) {
    wallet.charge();
  }
  const snapshot = stores.snapshots.get(revision.policySnapshotId);
  if (!snapshot) fail('trial_policy_missing');
  const trialEndsAt = revision.trialDays > 0
    ? input.now.getTime() + revision.trialDays * 86400000 : null;
  const entitlement: SkuEntitlement = {
    tenantUid: input.buyerUid,
    product: revision.product,
    skuRevisionId: revision.id,
    status: revision.trialDays > 0 ? 'trial' : 'active',
    trialEndsAt,
    policyDigest: snapshot.digest,
  };
  stores.entitlements.set(entitlementKey(input.buyerUid, revision.product), entitlement);
  const periodStart = utcMonthStart(input.now);
  for (const metric of AI_USAGE_METRICS) {
    seedQuota({
      quotas: stores.quotas, reservations: new Map(), events: new Map(),
      ledger: [], prices: stores.prices,
    }, {
      tenantUid: input.buyerUid,
      product: revision.product,
      metric,
      periodStart,
      limitUnits: snapshot.limits[metric],
    });
  }
  return entitlement;
}

export function enableSkuProduct(stores: SkuStores, input: {
  tenantUid: number;
  product: AiSkuProduct;
  enabled: boolean;
  now: Date;
}): { enabled: boolean } {
  if (!input.enabled) {
    stores.activations.set(activationKey(input.tenantUid, input.product), false);
    return { enabled: false };
  }
  const entitlement = stores.entitlements.get(entitlementKey(input.tenantUid, input.product));
  if (!entitlement) fail('not_entitled');
  if (entitlement.trialEndsAt != null && entitlement.trialEndsAt <= input.now.getTime()) {
    entitlement.status = 'expired';
    fail('entitlement_expired');
  }
  stores.activations.set(activationKey(input.tenantUid, input.product), true);
  return { enabled: true };
}

export function processingAdmission(stores: SkuStores, input: {
  tenantUid: number;
  product: AiSkuProduct;
  now: Date;
}): { allowed: boolean; reason: string | null; limits: TrialLimits | Record<string, never> } {
  const entitlement = stores.entitlements.get(entitlementKey(input.tenantUid, input.product));
  if (!entitlement) return { allowed: false, reason: 'not_entitled', limits: {} };
  if (entitlement.trialEndsAt != null && entitlement.trialEndsAt <= input.now.getTime()) {
    entitlement.status = 'expired';
    return { allowed: false, reason: 'entitlement_expired', limits: {} };
  }
  if (stores.activations.get(activationKey(input.tenantUid, input.product)) !== true) {
    return { allowed: false, reason: 'product_disabled', limits: {} };
  }
  const revision = stores.revisions.get(entitlement.skuRevisionId);
  const snapshot = revision ? stores.snapshots.get(revision.policySnapshotId) : undefined;
  return { allowed: true, reason: null, limits: snapshot?.limits ?? {} };
}
