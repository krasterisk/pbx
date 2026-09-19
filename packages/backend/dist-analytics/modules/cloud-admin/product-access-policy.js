"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_PRODUCT_MODULE_CODES = void 0;
exports.isAiProductCode = isAiProductCode;
exports.resolveProductAccess = resolveProductAccess;
exports.AI_PRODUCT_MODULE_CODES = ['ai_voice_robots', 'speech_analytics'];
function isAiProductCode(code) {
    return exports.AI_PRODUCT_MODULE_CODES.some((product) => product === code);
}
/** Pure, fail-closed policy. Legacy analytics grants never authorize voice robots. */
function resolveProductAccess(input) {
    const { product, tenant, grants, now } = input;
    const decision = {
        product, allowed: false, reason: null, source: 'none', policyRevision: 1,
        evaluatedAt: now.toISOString(), validUntil: null, limits: {},
    };
    if (!input.packageInstalled)
        return { ...decision, reason: 'package_missing' };
    if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled'
        || (tenant.status === 'trial' && (tenant.trial_ends_at == null
            || new Date(tenant.trial_ends_at).getTime() <= now.getTime()))) {
        return { ...decision, reason: 'tenant_inactive' };
    }
    if (input.deploymentMode.toUpperCase() !== 'CLOUD') {
        if (!input.localLicense) {
            return { ...decision, reason: input.localLicenseReason ?? 'license_invalid' };
        }
        decision.source = 'local_license';
        decision.validUntil = input.localLicense.expiresAt;
        decision.limits = input.localLicense.limits;
        if (Date.parse(input.localLicense.expiresAt) <= now.getTime()) {
            return { ...decision, reason: 'license_expired' };
        }
        if (!input.activationEnabled)
            return { ...decision, reason: 'product_disabled' };
        return { ...decision, allowed: true };
    }
    const explicit = grants.find((grant) => grant.module_code === product);
    const legacy = product === 'speech_analytics'
        ? grants.find((grant) => grant.module_code === 'cc_ai_voice') : undefined;
    const grant = explicit ?? legacy;
    if (!grant)
        return { ...decision, reason: 'not_entitled' };
    decision.source = explicit ? 'cloud_entitlement' : 'legacy_mapping';
    decision.validUntil = grant.expires_at ? new Date(grant.expires_at).toISOString() : null;
    if (grant.status === 'expired' || (grant.expires_at != null
        && new Date(grant.expires_at).getTime() <= now.getTime())) {
        return { ...decision, reason: 'entitlement_expired' };
    }
    if (grant.status !== 'active' && grant.status !== 'trial') {
        return { ...decision, reason: 'not_entitled' };
    }
    if (!input.activationEnabled)
        return { ...decision, reason: 'product_disabled' };
    return { ...decision, allowed: true };
}
//# sourceMappingURL=product-access-policy.js.map