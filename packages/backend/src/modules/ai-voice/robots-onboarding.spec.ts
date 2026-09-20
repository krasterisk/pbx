import {
  createDraftSku, emptySkuStores, enableSkuProduct, publishSku, purchaseSku,
} from '../ai-usage/sku-catalog';
import { evaluateSipProfile } from './realtime-session';
import {
  emptyRobotsOnboarding, expireAndDrain, onboardRobots, robotsOnboardingRequiresAnalytics,
  tryAdmitAfterDrain,
} from './robots-onboarding';

const now = new Date('2026-09-20T12:00:00.000Z');
const later = new Date('2026-10-10T12:00:00.000Z');
const limits = {
  concurrent_jobs: 2, concurrent_sessions: 1, storage_bytes: 1000,
  audio_ms: 10, provider_tokens: 50,
};

function entitledRobots(tenantUid: number, sku = emptySkuStores()) {
  createDraftSku(sku, {
    ownerTenantUid: tenantUid, skuCode: 'ai_voice_robots', product: 'ai_voice_robots',
    moneyPolicy: 'shadow', priceMonthlyMinor: 0, currency: 'RUB',
    trialDays: 14, limits, now,
  });
  publishSku(sku, tenantUid, 'ai_voice_robots');
  purchaseSku(sku, {
    buyerUid: tenantUid, ownerTenantUid: tenantUid, skuCode: 'ai_voice_robots', now,
  });
  enableSkuProduct(sku, {
    tenantUid, product: 'ai_voice_robots', enabled: true, now,
  });
  return emptyRobotsOnboarding(sku);
}

describe('10R robots onboarding', () => {
  it('walks provider → prompt → test → SIP → publish without analytics entitlement', () => {
    const stores = entitledRobots(8);
    expect(robotsOnboardingRequiresAnalytics()).toBe(false);
    expect(onboardRobots({ stores, tenantUid: 8, now, step: 'provider' }).next).toBe('prompt');
    expect(onboardRobots({ stores, tenantUid: 8, now, step: 'prompt' }).next).toBe('test');
    expect(onboardRobots({ stores, tenantUid: 8, now, step: 'test' }).next).toBe('sip_profile');
    expect(onboardRobots({
      stores, tenantUid: 8, now, step: 'sip_profile', transport: 'udp',
    })).toMatchObject({ next: 'publish', reason: null });
    expect(onboardRobots({ stores, tenantUid: 8, now, step: 'publish' }).next).toBe('done');
    expect(stores.sku.entitlements.has('8:speech_analytics')).toBe(false);
  });

  it('keeps unsupported SIP and native PBX without I4 disabled, not ready', () => {
    expect(evaluateSipProfile({ transport: 'tls' })).toEqual({
      status: 'disabled', reason: 'sip_profile_unsupported', ready: false,
    });
    expect(evaluateSipProfile({ transport: 'udp', nativePbx: true, i4Evidence: false })).toEqual({
      status: 'disabled', reason: 'native_pbx_gated', ready: false,
    });
    const stores = entitledRobots(8);
    onboardRobots({ stores, tenantUid: 8, now, step: 'provider' });
    onboardRobots({ stores, tenantUid: 8, now, step: 'prompt' });
    onboardRobots({ stores, tenantUid: 8, now, step: 'test' });
    expect(onboardRobots({
      stores, tenantUid: 8, now, step: 'sip_profile', transport: 'tls',
    })).toMatchObject({ next: 'sip_profile', reason: 'sip_profile_unsupported' });
    expect(() => onboardRobots({ stores, tenantUid: 8, now, step: 'publish' }))
      .toThrow(/sip_profile_unsupported/);
  });

  it('drains ready deployments on expiry and denies new sessions', () => {
    const stores = entitledRobots(8);
    onboardRobots({ stores, tenantUid: 8, now, step: 'provider' });
    onboardRobots({ stores, tenantUid: 8, now, step: 'prompt' });
    onboardRobots({ stores, tenantUid: 8, now, step: 'test' });
    const admitted = tryAdmitAfterDrain({ stores, tenantUid: 8, ingressKey: 'live-1' });
    expect(admitted.id).toBeTruthy();
    const drain = expireAndDrain({ stores, tenantUid: 8, now: later });
    expect(drain.admissionsStopped).toBe(true);
    expect(drain.drained).toHaveLength(1);
    expect(() => tryAdmitAfterDrain({ stores, tenantUid: 8, ingressKey: 'new-2' }))
      .toThrow(/admissions_stopped/);
    expect(stores.sessions.get(admitted.id)?.ingressKey).toBe('live-1');
  });
});
