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
