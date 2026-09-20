"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProcessInstallFlags = readProcessInstallFlags;
exports.resolveProductRuntime = resolveProductRuntime;
exports.entitledFromDecision = entitledFromDecision;
exports.offlineHeartbeatPolicy = offlineHeartbeatPolicy;
exports.healthProductRuntime = healthProductRuntime;
function readProcessInstallFlags(env = process.env) {
    return {
        schemaReady: env.AI_SCHEMA_READY === '1',
        workersConfigured: env.AI_WORKERS_CONFIGURED === '1',
    };
}
function resolveProductRuntime(input) {
    if (input.profile === 'community-pbx' || input.profile === 'community-core') {
        return { productRuntime: 'community-core', usable: true };
    }
    if (input.expired) {
        return { productRuntime: 'expired', usable: false };
    }
    const processReady = input.schemaReady && input.workersConfigured;
    if (input.entitled && processReady) {
        return { productRuntime: 'installed', usable: input.allowed };
    }
    if (input.entitled) {
        return { productRuntime: 'entitled-not-installed', usable: false };
    }
    return { productRuntime: 'not-installed', usable: false };
}
function entitledFromDecision(decision) {
    const expired = decision.reason === 'license_expired' || decision.reason === 'entitlement_expired';
    const entitled = decision.allowed || decision.reason === 'product_disabled' || expired;
    return { entitled, expired };
}
/** Offline BOX profile must not require a license heartbeat. */
function offlineHeartbeatPolicy(env = process.env) {
    if (env.AI_LICENSE_PROFILE === 'offline' && env.AI_LICENSE_HEARTBEAT === '1') {
        throw Object.assign(new Error('offline profile forbids mandatory license heartbeat'), {
            code: 'license_heartbeat_forbidden',
        });
    }
    return { required: false, outbound: false };
}
/**
 * Unauthenticated /health productRuntime.
 * Default stays not-installed. Conscious pilot flip requires AI_PRODUCT_RUNTIME_PILOT=1
 * plus schema+workers flags. Does not enable cloud_wallet or commercial readiness claims.
 */
function healthProductRuntime(profile, env = process.env) {
    const flags = readProcessInstallFlags(env);
    const pilot = env.AI_PRODUCT_RUNTIME_PILOT === '1';
    if (!pilot) {
        return {
            status: 'ok', profile, productRuntime: 'not-installed', usable: false, pilot: false,
        };
    }
    const runtime = resolveProductRuntime({
        profile,
        ...flags,
        entitled: true,
        expired: false,
        allowed: true,
    });
    return {
        status: 'ok',
        profile,
        productRuntime: runtime.productRuntime,
        usable: runtime.usable,
        pilot: true,
    };
}
//# sourceMappingURL=product-runtime.js.map
