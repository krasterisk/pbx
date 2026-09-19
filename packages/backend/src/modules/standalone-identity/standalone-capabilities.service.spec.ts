import { ServiceUnavailableException } from '@nestjs/common';
import { StandaloneCapabilitiesService } from './standalone-capabilities.service';

describe('StandaloneCapabilitiesService', () => {
  const context = {
    tenantUid: 42, principalKind: 'user' as const, principalId: 'user:7',
    permissionRevision: '1', requestId: 'req',
  };
  const entitlement = {
    product: 'speech_analytics', allowed: false, reason: 'license_invalid',
    source: 'none', policyRevision: 1, evaluatedAt: '2026-09-19T00:00:00.000Z',
    validUntil: null, limits: {},
  };
  const products = { decide: jest.fn().mockResolvedValue(entitlement) };
  const service = new StandaloneCapabilitiesService(products as any);
  const previousProfile = process.env.DB_SCHEMA_PROFILE;

  afterEach(() => {
    jest.clearAllMocks();
    if (previousProfile === undefined) delete process.env.DB_SCHEMA_PROFILE;
    else process.env.DB_SCHEMA_PROFILE = previousProfile;
  });

  it('returns this composition product policy without claiming a runtime', async () => {
    process.env.DB_SCHEMA_PROFILE = 'analytics-api';
    await expect(service.forContext(context)).resolves.toEqual({
      tenantUid: 42, principalKind: 'user', principalId: 'user:7',
      profile: 'analytics-api', productRuntime: 'not-installed', usable: false,
      entitlement,
    });
    expect(products.decide).toHaveBeenCalledWith(42, 'speech_analytics', expect.any(Date));
  });

  it('maps robot-api to the voice robots entitlement', async () => {
    process.env.DB_SCHEMA_PROFILE = 'robot-api';
    products.decide.mockResolvedValue({ ...entitlement, product: 'ai_voice_robots' });
    await expect(service.forContext(context)).resolves.toMatchObject({
      profile: 'robot-api', usable: false, productRuntime: 'not-installed',
      entitlement: { product: 'ai_voice_robots' },
    });
    expect(products.decide).toHaveBeenCalledWith(42, 'ai_voice_robots', expect.any(Date));
  });

  it('refuses to describe capabilities when the schema profile is missing', async () => {
    delete process.env.DB_SCHEMA_PROFILE;
    await expect(service.forContext(context)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(products.decide).not.toHaveBeenCalled();
  });
});
