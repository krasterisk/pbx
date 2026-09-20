"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectAutodialTrunk = selectAutodialTrunk;
exports.resolveAutodialCallerId = resolveAutodialCallerId;
/**
 * Weighted round-robin across the campaign's trunks. `cursor` is the campaign's
 * running attempt counter, which keeps the rotation stable across restarts
 * without extra state.
 */
function selectAutodialTrunk(pool, cidPolicy, number, cursor, allowedTrunkIds) {
    const usable = (pool ?? []).filter((trunk) => !!trunk.trunk_id && (!allowedTrunkIds || allowedTrunkIds.has(trunk.trunk_id)));
    if (!usable.length)
        return null;
    const expanded = [];
    for (const item of usable) {
        const weight = Math.max(1, Math.min(64, item.weight ?? 1));
        for (let i = 0; i < weight; i++)
            expanded.push(item);
    }
    const picked = expanded[Math.abs(cursor) % expanded.length];
    return {
        trunkId: picked.trunk_id,
        callerId: resolveAutodialCallerId(cidPolicy, picked, cursor),
        callerIdSource: picked.caller_id_source,
        endpoint: `PJSIP/${number}@${picked.trunk_id}`,
    };
}
function resolveAutodialCallerId(policy, trunk, cursor) {
    const source = trunk.caller_id_source;
    if (source?.mode === 'static')
        return source.value?.trim() || null;
    if (source?.mode === 'pool') {
        const numbers = (Array.isArray(source.numbers) ? source.numbers : [])
            .map((value) => value.trim())
            .filter(Boolean);
        if (!numbers.length)
            return trunk.caller_id?.trim() || null;
        if (source.pick === 'random')
            return numbers[Math.abs(hashCursor(cursor, trunk.trunk_id)) % numbers.length];
        return numbers[Math.abs(cursor) % numbers.length];
    }
    switch (policy?.mode) {
        case 'static':
            return policy.value?.trim() || null;
        case 'rotate': {
            const pool = (policy.pool ?? []).filter((v) => !!v.trim());
            if (!pool.length)
                return policy.value?.trim() || null;
            return pool[Math.abs(cursor) % pool.length];
        }
        case 'per_trunk':
        default:
            return trunk.caller_id?.trim() || policy?.value?.trim() || null;
    }
}
/** A stable per-trunk spread without process-local state or cross-worker races. */
function hashCursor(cursor, trunkId) {
    let hash = Math.abs(cursor) || 1;
    for (const char of trunkId)
        hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return hash;
}
//# sourceMappingURL=autodial-trunk.util.js.map