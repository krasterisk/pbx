import {
  createDraftSku, enableSkuProduct, publishSku, purchaseSku,
} from '../ai-usage/sku-catalog';
import {
  ANALYTICS_ONBOARDING_STEPS, analyticsCiUsesShadow, analyticsOnboardingRequiresRobots,
  deleteAnalysis, emptyAnalyticsOnboarding, exportAnalysis, hidePbxFields,
  offboardAnalytics, onboardAnalytics, rotateIntegrationKey,
} from './analytics-onboarding';

const now = new Date('2026-09-20T12:00:00.000Z');
const limits = {
  concurrent_jobs: 2, concurrent_sessions: 1, storage_bytes: 1000,
  audio_ms: 10, provider_tokens: 50,
};

function entitled(tenantUid: number, stores = emptyAnalyticsOnboarding()) {
  createDraftSku(stores.sku, {
    ownerTenantUid: tenantUid, skuCode: 'speech_analytics', product: 'speech_analytics',
    moneyPolicy: 'shadow', priceMonthlyMinor: 0, currency: 'RUB',
    trialDays: 14, limits, now,
  });
  publishSku(stores.sku, tenantUid, 'speech_analytics');
  purchaseSku(stores.sku, {
    buyerUid: tenantUid, ownerTenantUid: tenantUid, skuCode: 'speech_analytics', now,
  });
  enableSkuProduct(stores.sku, {
    tenantUid, product: 'speech_analytics', enabled: true, now,
  });
  return stores;
}

function completeOnboarding(stores: ReturnType<typeof emptyAnalyticsOnboarding>, tenantUid: number) {
  expect(onboardAnalytics({ stores, tenantUid, now, step: 'project' }).next).toBe('integration_key');
  expect(onboardAnalytics({ stores, tenantUid, now, step: 'integration_key' }).next).toBe('sample_upload');
  expect(onboardAnalytics({ stores, tenantUid, now, step: 'sample_upload' }).next).toBe('result');
  return onboardAnalytics({ stores, tenantUid, now, step: 'result' });
}

describe('10A analytics onboarding', () => {
  it('walks project → key → sample upload → result without robots or PBX', () => {
    const stores = entitled(8);
    const done = completeOnboarding(stores, 8);
    expect(done).toEqual({ step: 'result', next: 'done', id: 'run-8' });
    expect(ANALYTICS_ONBOARDING_STEPS).toEqual([
      'project', 'integration_key', 'sample_upload', 'result',
    ]);
    expect(analyticsOnboardingRequiresRobots()).toBe(false);
    expect(hidePbxFields('analytics-api', {
      project: 'Pilot', ami: 'secret', ari: 'secret', pbx: 1, queue: 'q',
    })).toEqual({ project: 'Pilot' });
  });

  it('keeps SaaS tenant A from reading tenant B analysis or keys', () => {
    const stores = entitled(8);
    entitled(9, stores);
    completeOnboarding(stores, 8);
    completeOnboarding(stores, 9);
    expect(() => onboardAnalytics({
      stores, tenantUid: 8, now, step: 'sample_upload', projectId: 'proj-9', keyId: 'key-9',
    })).toThrow(/project_tenant_denied/);
    expect(exportAnalysis(stores, 8, 'run-9', 'analytics:read').reason).toBe('acl_denied');
    expect(() => rotateIntegrationKey(stores, 8, 'key-9')).toThrow(/key_tenant_denied/);
  });

  it('fails closed on retention, ACL expansion and foreign delete, then receipts offboard', () => {
    const stores = entitled(8);
    completeOnboarding(stores, 8);
    const hold = deleteAnalysis(
      stores, 8, 'run-8', now, new Date('2026-09-21T00:00:00.000Z'),
    );
    expect(hold).toMatchObject({ allowed: false, reason: 'retention_hold' });
    expect(stores.analyses.get('run-8')?.status).toBe('ready');
    expect(exportAnalysis(stores, 8, 'run-8', 'analytics:audio').reason).toBe('acl_not_expanded');
    expect(deleteAnalysis(stores, 9, 'run-8', now, now).reason).toBe('acl_denied');
    expect(deleteAnalysis(stores, 8, 'run-8', now, now).allowed).toBe(true);
    expect(offboardAnalytics(stores, 8).kind).toBe('offboard');
    expect(stores.analyses.get('run-8')?.status).toBe('deleted');
  });

  it('shows the integration secret once and keeps CI on the shadow billable path', () => {
    const stores = entitled(8);
    completeOnboarding(stores, 8);
    expect(rotateIntegrationKey(stores, 8, 'key-8').secretOnce).toMatch(/^sa-once-/);
    expect(() => rotateIntegrationKey(stores, 8, 'key-8')).toThrow(/secret_already_shown/);
    expect(analyticsCiUsesShadow()).toBe(true);
  });
});
