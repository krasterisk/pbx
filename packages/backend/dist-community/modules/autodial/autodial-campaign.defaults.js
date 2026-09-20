"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAutodialPacing = defaultAutodialPacing;
exports.defaultAutodialRetry = defaultAutodialRetry;
exports.defaultAutodialAmd = defaultAutodialAmd;
exports.defaultAutodialCidPolicy = defaultAutodialCidPolicy;
exports.defaultAutodialTrunkPool = defaultAutodialTrunkPool;
exports.normalizeAutodialPacing = normalizeAutodialPacing;
exports.normalizeAutodialPredictive = normalizeAutodialPredictive;
exports.normalizeAutodialRetry = normalizeAutodialRetry;
const autodial_predictive_util_1 = require("./autodial-predictive.util");
function defaultAutodialPacing() {
    return {
        providers: [{ type: 'static', max_channels: 5 }],
        power_ratio: 2,
    };
}
function defaultAutodialRetry() {
    return {
        max_attempts: 3,
        default_interval_sec: 3600,
        intervals_sec: {
            no_answer: 1800,
            busy: 600,
            congestion: 900,
            failed: 1200,
        },
    };
}
function defaultAutodialAmd() {
    return { enabled: false, on_machine: 'hangup' };
}
function defaultAutodialCidPolicy() {
    return { mode: 'per_trunk' };
}
function defaultAutodialTrunkPool() {
    return [];
}
/**
 * Per-provider required fields cannot be expressed in a single class-validator
 * DTO, so the shape is settled here: a provider missing its own limit falls
 * back to a conservative one rather than being dropped.
 */
function normalizeAutodialPacing(input) {
    const raw = input?.providers ?? [];
    const providers = [];
    for (const entry of raw) {
        const provider = (entry ?? {});
        const type = String(provider.type ?? '');
        const maxChannels = Math.max(1, Number(provider.max_channels ?? 0) || 1);
        switch (type) {
            case 'static':
                providers.push({ type: 'static', max_channels: maxChannels });
                break;
            case 'tenant_cap':
                providers.push({ type: 'tenant_cap', max_channels: maxChannels });
                break;
            case 'trunk_channels':
                providers.push({ type: 'trunk_channels' });
                break;
            case 'queue_agents': {
                const queueNames = Array.isArray(provider.queue_names)
                    ? provider.queue_names.map((n) => String(n)).filter(Boolean)
                    : [];
                const ratio = Number(provider.ratio ?? 0);
                providers.push({
                    type: 'queue_agents',
                    queue_names: queueNames,
                    ...(ratio > 0 ? { ratio } : {}),
                });
                break;
            }
        }
    }
    const powerRatio = Number(input?.power_ratio ?? 0);
    const predictive = input?.predictive
        ? { predictive: normalizeAutodialPredictive(input.predictive) }
        : {};
    if (!providers.length)
        return { ...defaultAutodialPacing(), ...predictive };
    return {
        providers,
        ...(powerRatio > 0 ? { power_ratio: powerRatio } : {}),
        ...predictive,
    };
}
/**
 * Clamped rather than rejected: a campaign that arrives with an out-of-range
 * target must still dial, and the safe reading of a bad abandon target is the
 * conservative one.
 */
function normalizeAutodialPredictive(input) {
    const fallback = (0, autodial_predictive_util_1.defaultAutodialPredictive)();
    return {
        target_abandon_pct: clamp(Number(input.target_abandon_pct ?? fallback.target_abandon_pct), 0, 20, fallback.target_abandon_pct),
        max_over_dial: clamp(Number(input.max_over_dial ?? fallback.max_over_dial), 1, 5, fallback.max_over_dial),
        min_samples: Math.round(clamp(Number(input.min_samples ?? fallback.min_samples), 1, 1000, fallback.min_samples)),
    };
}
function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}
function normalizeAutodialRetry(input) {
    const fallback = defaultAutodialRetry();
    if (!input)
        return fallback;
    return {
        max_attempts: Math.max(1, Number(input.max_attempts ?? fallback.max_attempts)),
        default_interval_sec: Math.max(0, Number(input.default_interval_sec ?? fallback.default_interval_sec)),
        intervals_sec: input.intervals_sec ?? {},
    };
}
//# sourceMappingURL=autodial-campaign.defaults.js.map