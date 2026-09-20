import {
  entitledFromDecision, offlineHeartbeatPolicy, readProcessInstallFlags,
  resolveProductRuntime,
} from './product-runtime';

describe('COM3 product runtime flag', () => {
  it('keeps community usable without an AI SKU', () => {
    expect(resolveProductRuntime({
      profile: 'community-pbx', schemaReady: false, workersConfigured: false,
      entitled: false, expired: false, allowed: false,
    })).toEqual({ productRuntime: 'community-core', usable: true });
  });

  it('distinguishes entitled-not-installed from entitled-installed', () => {
    expect(resolveProductRuntime({
      profile: 'analytics-api', schemaReady: false, workersConfigured: false,
      entitled: true, expired: false, allowed: true,
    })).toEqual({ productRuntime: 'entitled-not-installed', usable: false });
    expect(resolveProductRuntime({
      profile: 'analytics-api', schemaReady: true, workersConfigured: true,
      entitled: true, expired: false, allowed: true,
    })).toEqual({ productRuntime: 'installed', usable: true });
    expect(resolveProductRuntime({
      profile: 'robot-api', schemaReady: true, workersConfigured: true,
      entitled: true, expired: false, allowed: false,
    })).toEqual({ productRuntime: 'installed', usable: false });
  });

  it('stops new work on expiry without deleting community-core', () => {
    expect(resolveProductRuntime({
      profile: 'analytics-api', schemaReady: true, workersConfigured: true,
      entitled: true, expired: true, allowed: false,
    })).toEqual({ productRuntime: 'expired', usable: false });
    expect(resolveProductRuntime({
      profile: 'community-core', schemaReady: true, workersConfigured: true,
      entitled: false, expired: true, allowed: false,
    }).productRuntime).toBe('community-core');
  });

  it('defaults process flags off and forbids offline heartbeat', () => {
    expect(readProcessInstallFlags({})).toEqual({ schemaReady: false, workersConfigured: false });
    expect(readProcessInstallFlags({ AI_SCHEMA_READY: '1', AI_WORKERS_CONFIGURED: '1' }))
      .toEqual({ schemaReady: true, workersConfigured: true });
    expect(offlineHeartbeatPolicy({ AI_LICENSE_PROFILE: 'offline' }))
      .toEqual({ required: false, outbound: false });
    expect(() => offlineHeartbeatPolicy({
      AI_LICENSE_PROFILE: 'offline', AI_LICENSE_HEARTBEAT: '1',
    })).toThrow(/heartbeat/);
    expect(entitledFromDecision({ allowed: false, reason: 'product_disabled' }))
      .toEqual({ entitled: true, expired: false });
    expect(entitledFromDecision({ allowed: false, reason: 'license_expired' }))
      .toEqual({ entitled: true, expired: true });
    expect(entitledFromDecision({ allowed: false, reason: 'not_entitled' }))
      .toEqual({ entitled: false, expired: false });
  });
});
