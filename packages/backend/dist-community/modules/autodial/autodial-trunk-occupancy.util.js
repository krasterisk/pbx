"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTrunkChannelLimit = resolveTrunkChannelLimit;
exports.countChannelsByTrunk = countChannelsByTrunk;
/**
 * Campaign-level max_channels overrides the trunk's first-class limit.
 * Either value ≤ 0 means "this layer does not constrain the trunk".
 */
function resolveTrunkChannelLimit(campaignMax, trunkMax) {
    const campaign = Number(campaignMax ?? 0);
    if (campaign > 0)
        return Math.round(campaign);
    const inherited = Number(trunkMax ?? 0);
    return inherited > 0 ? Math.round(inherited) : 0;
}
/**
 * Count live PJSIP channels per trunk from a CoreShowChannels event list.
 * Asterisk names outbound channels `PJSIP/{endpoint}-XXXXXXXX`.
 */
function countChannelsByTrunk(events, trunkIds) {
    const counts = new Map();
    const prefixes = trunkIds
        .filter(Boolean)
        .map((id) => ({ id, prefix: `PJSIP/${id}-`, exact: `PJSIP/${id}` }));
    for (const { id } of prefixes)
        counts.set(id, 0);
    for (const event of events) {
        const type = String(event.event ?? '');
        if (type && type !== 'CoreShowChannel')
            continue;
        const name = String(event.channel ?? event.Channel ?? '');
        if (!name)
            continue;
        for (const { id, prefix, exact } of prefixes) {
            if (name.startsWith(prefix) || name === exact) {
                counts.set(id, (counts.get(id) ?? 0) + 1);
                break;
            }
        }
    }
    return counts;
}
//# sourceMappingURL=autodial-trunk-occupancy.util.js.map