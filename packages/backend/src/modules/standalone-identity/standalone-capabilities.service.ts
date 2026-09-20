import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProductAccessService } from '../product-access/product-access.service';
import {
  entitledFromDecision, offlineHeartbeatPolicy, readProcessInstallFlags, resolveProductRuntime,
} from '../product-access/product-runtime';
import type { TenantContext } from '../integration-credentials/tenant-context';

const PROFILE_PRODUCT = {
  'analytics-api': 'speech_analytics',
  'robot-api': 'ai_voice_robots',
} as const;

/** Tenant identity plus computed productRuntime. Default env stays not-installed. */
@Injectable()
export class StandaloneCapabilitiesService {
  constructor(private readonly products: ProductAccessService) {}

  async forContext(context: TenantContext, now = new Date()) {
    const profile = process.env.DB_SCHEMA_PROFILE;
    if (profile !== 'analytics-api' && profile !== 'robot-api') {
      throw new ServiceUnavailableException({ code: 'profile_mismatch' });
    }
    const product = PROFILE_PRODUCT[profile];
    offlineHeartbeatPolicy();
    const entitlement = await this.products.decide(context.tenantUid, product, now);
    const flags = readProcessInstallFlags();
    const { entitled, expired } = entitledFromDecision(entitlement);
    const runtime = resolveProductRuntime({
      profile, ...flags, entitled, expired, allowed: entitlement.allowed,
    });
    return {
      tenantUid: context.tenantUid,
      principalKind: context.principalKind,
      principalId: context.principalId,
      profile,
      productRuntime: runtime.productRuntime,
      usable: runtime.usable,
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
