"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCcEventToBusEvent = mapCcEventToBusEvent;
/**
 * Map a raw CcEvent (SSE envelope) into a CcEventBusEvent when the type is known.
 * Returns null for legacy SSE types that are not part of the typed AI contract.
 */
function mapCcEventToBusEvent(type, data) {
    switch (type) {
        case 'agent.stateChanged':
            return { type: 'agent.stateChanged', agent: data };
        case 'call.started':
            return { type: 'call.started', call: data };
        case 'call.ended':
            return {
                type: 'call.ended',
                call: data,
                disposition: (data?.disposition ?? 'answered'),
            };
        case 'queue.statsChanged':
            return { type: 'queue.statsChanged', queue: data };
        case 'media.pcmFrame':
            return {
                type: 'media.pcmFrame',
                channelId: String(data?.channelId ?? ''),
                frame: Buffer.isBuffer(data?.frame) ? data.frame : Buffer.from(data?.frame ?? []),
                callUniqueid: data?.callUniqueid,
            };
        // Legacy SSE aliases → typed contract (optional bridging for consumers)
        case 'agentUpdate':
            return { type: 'agent.stateChanged', agent: data };
        case 'queueUpdate':
            return { type: 'queue.statsChanged', queue: data };
        case 'callNew':
            return { type: 'call.started', call: data };
        case 'callEnd':
            return {
                type: 'call.ended',
                call: data,
                disposition: mapDisposition(data?.reason),
            };
        default:
            return null;
    }
}
function mapDisposition(reason) {
    if (reason === 'abandoned' || reason === 'transferred')
        return reason;
    return 'answered';
}
//# sourceMappingURL=cc-event-bus.types.js.map