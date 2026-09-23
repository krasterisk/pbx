import { BadRequestException, ConflictException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { SkuCatalogService } from './sku-catalog.service';

function offer(status: 'draft' | 'published' | 'revoked', revisionId = 'rev-1') {
  return {
    sku_code: 'speech_analytics', product: 'speech_analytics', status,
    current_revision_id: revisionId, update: jest.fn(),
  };
}

function revision(patch: Record<string, unknown> = {}) {
  return {
    id: 'rev-1', product: 'speech_analytics', money_policy: 'shadow',
    price_monthly_minor: '0', trial_days: 0, policy_snapshot_id: 'snap-1',
    ...patch,
  };
}

describe('SkuCatalogService purchase persistence', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const charge = jest.fn();
    const deposit = jest.fn();
    const entitlementsCreate = jest.fn().mockResolvedValue({});
    const quotasBulk = jest.fn().mockResolvedValue([]);
    const tenantModulesUpsert = jest.fn();
    const sequelize = {
      transaction: jest.fn(async (fn: (t: { LOCK: { UPDATE: string } }) => unknown) =>
        fn({ LOCK: { UPDATE: 'UPDATE' } })),
    };
    const service = new SkuCatalogService(
      { findOne: jest.fn().mockResolvedValue({ id: 10, vpbx_user_uid: 8 }) } as any,
      { upsert: tenantModulesUpsert } as any,
      { findByPk: jest.fn().mockResolvedValue({
        concurrent_jobs: '2', concurrent_sessions: '1', storage_bytes: '1',
        audio_ms: '1', provider_tokens: '1', digest: 'aa'.repeat(32),
      }) } as any,
      { findByPk: jest.fn().mockResolvedValue(revision(overrides.revision as any)) } as any,
      { findOne: jest.fn().mockResolvedValue(overrides.offer ?? offer('published')) } as any,
      { findOne: jest.fn().mockResolvedValue(overrides.existing ?? null), create: entitlementsCreate } as any,
      { bulkCreate: quotasBulk } as any,
      {} as any,
      { charge, deposit } as any,
      sequelize as any,
      { setActivation: jest.fn().mockResolvedValue({
        product: 'speech_analytics', enabled: true, revision: 1,
      }) } as any,
    );
    return { service, charge, deposit, entitlementsCreate, tenantModulesUpsert };
  }

  it('denies unpublished SKUs before any wallet debit', async () => {
    const { service, charge } = build({ offer: offer('draft') });
    await expect(service.purchase(8, 'speech_analytics', 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(charge).not.toHaveBeenCalled();
  });

  it('does not call wallet charge on local_byok', async () => {
    const { service, charge, entitlementsCreate } = build({
      revision: { money_policy: 'local_byok', price_monthly_minor: '0' },
    });
    await expect(service.purchase(8, 'speech_analytics', 1)).resolves.toMatchObject({
      entitled: true, enabled: false,
    });
    expect(charge).not.toHaveBeenCalled();
    expect(entitlementsCreate).toHaveBeenCalled();
  });

  it('charges SaaS wallet once for a priced shadow SKU', async () => {
    const { service, charge } = build({
      revision: { money_policy: 'shadow', price_monthly_minor: '250000' },
    });
    charge.mockResolvedValue({ id: 1 });
    await expect(service.purchase(8, 'speech_analytics', 1)).resolves.toMatchObject({
      amountRub: 2500, entitled: true, enabled: false,
    });
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('maps a second purchase unique row to ALREADY_ACTIVE', async () => {
    const { service, entitlementsCreate } = build();
    entitlementsCreate.mockRejectedValue(new UniqueConstraintError({ errors: [] }));
    await expect(service.purchase(8, 'speech_analytics', 1)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SkuCatalogService operator entitle', () => {
  function buildEntitle(
    existing: { status: string } | null = null,
    tenantPatch: Record<string, unknown> = {},
  ) {
    const setActivation = jest.fn().mockResolvedValue({
      product: 'speech_analytics', enabled: true, revision: 1,
    });
    const charge = jest.fn();
    const tenantModulesUpsert = jest.fn();
    const tenant = {
      id: 10, vpbx_user_uid: 8, status: 'active', trial_ends_at: null,
      update: jest.fn(async (patch: Record<string, unknown>) => Object.assign(tenant, patch)),
      ...tenantPatch,
    };
    const row = {
      status: existing?.status ?? 'active',
      trial_ends_at: null as Date | null,
      update: jest.fn(async (patch: Record<string, unknown>) => Object.assign(row, patch)),
    };
    const entitlementFind = jest.fn()
      .mockResolvedValueOnce(existing ? row : null)
      .mockResolvedValue(row);
    const service = new SkuCatalogService(
      { findByPk: jest.fn().mockResolvedValue(tenant) } as any,
      { upsert: tenantModulesUpsert } as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(offer('published')) } as any,
      { findOne: entitlementFind, create: jest.fn() } as any,
      { bulkCreate: jest.fn() } as any,
      {} as any,
      { charge, deposit: jest.fn() } as any,
      { transaction: jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: 'UPDATE' } })) } as any,
      { setActivation } as any,
    );
    return { service, setActivation, charge, tenant, row, tenantModulesUpsert };
  }

  it('purchases a published 0 RUB SKU then activates', async () => {
    const { service, setActivation, charge } = buildEntitle();
    jest.spyOn(service, 'purchase').mockResolvedValue({
      skuCode: 'speech_analytics', product: 'speech_analytics',
      amountRub: 0, entitled: true, enabled: false,
    } as any);
    await expect(service.entitleOperator(10, 'speech_analytics', 1)).resolves.toMatchObject({
      enabled: true, product: 'speech_analytics',
    });
    expect(service.purchase).toHaveBeenCalledWith(8, 'speech_analytics', 1);
    expect(setActivation).toHaveBeenCalledWith(8, 'speech_analytics', true, 1);
    expect(charge).not.toHaveBeenCalled();
  });

  it('skips purchase when the cabinet is already entitled', async () => {
    const { service, setActivation } = buildEntitle({ status: 'active' });
    const purchase = jest.spyOn(service, 'purchase');
    await service.entitleOperator(10, 'speech_analytics', 1);
    expect(purchase).not.toHaveBeenCalled();
    expect(setActivation).toHaveBeenCalledWith(8, 'speech_analytics', true, 1);
  });

  it('opens a trial or suspended cabinet before activation', async () => {
    const { service, tenant } = buildEntitle(null, {
      status: 'trial', trial_ends_at: null,
    });
    jest.spyOn(service, 'purchase').mockResolvedValue({
      skuCode: 'speech_analytics', product: 'speech_analytics',
      amountRub: 0, entitled: true, enabled: false,
    } as any);
    await service.entitleOperator(10, 'speech_analytics', 1);
    expect(tenant.update).toHaveBeenCalledWith({ status: 'active', trial_ends_at: null });
  });

  it('refuses a cancelled cabinet', async () => {
    const { service, tenant } = buildEntitle(null, { status: 'cancelled' });
    await expect(service.entitleOperator(10, 'speech_analytics', 1))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'tenant_inactive' }) });
    expect(tenant.update).not.toHaveBeenCalled();
  });

  it('sets a trial clock without charging the wallet', async () => {
    const { service, row, tenantModulesUpsert, charge } = buildEntitle({ status: 'active' });
    const before = Date.now();
    await service.entitleOperator(10, 'speech_analytics', 1, { trialDays: 14 });
    expect(charge).not.toHaveBeenCalled();
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'trial' }));
    const ends = row.update.mock.calls[0][0].trial_ends_at as Date;
    expect(ends.getTime()).toBeGreaterThan(before + 13 * 86400000);
    expect(tenantModulesUpsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 10, module_code: 'speech_analytics', status: 'trial', expires_at: ends,
    }));
  });
});

describe('SkuCatalogService draft snapshot reuse', () => {
  it('reuses an existing policy snapshot with the same digest', async () => {
    const snapshotFind = jest.fn().mockResolvedValue({ id: 'snap-existing' });
    const snapshotCreate = jest.fn();
    const revisionCreate = jest.fn().mockResolvedValue({});
    const offerCreate = jest.fn().mockResolvedValue({});
    const query = jest.fn();
    const service = new SkuCatalogService(
      {} as any,
      {} as any,
      { findOne: snapshotFind, create: snapshotCreate } as any,
      { create: revisionCreate } as any,
      { create: offerCreate } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { transaction: jest.fn(async (fn: any) => fn({})) } as any,
      {} as any,
    );
    (service as any).sequelize.query = query;
    await expect(service.createDraft({
      ownerTenantUid: 362,
      skuCode: 'speech_analytics',
      product: 'speech_analytics',
      moneyPolicy: 'shadow',
      priceMonthlyMinor: 0,
      currency: 'RUB',
      trialDays: 0,
    })).resolves.toMatchObject({ skuCode: 'speech_analytics', status: 'draft' });
    expect(snapshotCreate).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      owner_tenant_uid: 362,
      sku_code: 'speech_analytics',
      policy_snapshot_id: 'snap-existing',
    }), expect.anything());
  });
});
