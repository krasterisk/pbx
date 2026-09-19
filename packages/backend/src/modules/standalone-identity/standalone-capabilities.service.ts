import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProductAccessService } from '../product-access/product-access.service';
import type { TenantContext } from '../integration-credentials/tenant-context';

const PROFILE_PRODUCT = {
  'analytics-api': 'speech_analytics',
  'robot-api': 'ai_voice_robots',
} as const;

/** Tenant identity plus product policy for a standalone composition. Runtime is not implied. */
@Injectable()
export class StandaloneCapabilitiesService {
  constructor(private readonly products: ProductAccessService) {}

  async forContext(context: TenantContext, now = new Date()) {
    const profile = process.env.DB_SCHEMA_PROFILE;
    if (profile !== 'analytics-api' && profile !== 'robot-api') {
      throw new ServiceUnavailableException({ code: 'profile_mismatch' });
    }
    const product = PROFILE_PRODUCT[profile];
    const entitlement = await this.products.decide(context.tenantUid, product, now);
    return {
      tenantUid: context.tenantUid,
      principalKind: context.principalKind,
      principalId: context.principalId,
      profile,
      productRuntime: 'not-installed' as const,
      usable: false,
      entitlement: {
        product: entitlement.product,
        allowed: entitlement.allowed,
        reason: entitlement.reason,
        source: entitlement.source,
        policyRevision: entitlement.policyRevision,
        evaluatedAt: entitlement.evaluatedAt,
        validUntil: entitlement.validUntil,
        limits: entitlement.limits,
      },
    };
  }
}
