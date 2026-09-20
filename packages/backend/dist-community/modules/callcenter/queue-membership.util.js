"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relatedQueueInterfaces = relatedQueueInterfaces;
exports.planQueueMembership = planQueueMembership;
exports.mergeRelatedQueueMembership = mergeRelatedQueueMembership;
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
/** Queue member interfaces for a primary/WebRTC pair. */
function relatedQueueInterfaces(agentInterface) {
    const tech = agentInterface.includes('/')
        ? agentInterface.slice(0, agentInterface.indexOf('/') + 1)
        : 'PJSIP/';
    const sipId = agentInterface.includes('/')
        ? agentInterface.slice(agentInterface.indexOf('/') + 1)
        : agentInterface;
    const related = new Set([`PJSIP/${sipId}`, `${tech}${sipId}`, agentInterface]);
    const twin = (0, endpoint_ids_util_1.isWebrtcCompanion)(sipId) ? (0, endpoint_ids_util_1.primaryIdOf)(sipId) : (0, endpoint_ids_util_1.companionIdOf)(sipId);
    if (twin) {
        related.add(`PJSIP/${twin}`);
        related.add(`${tech}${twin}`);
    }
    return [...related];
}
/**
 * AMI QueueMember is the displayed membership.
 * Session snapshot only lists queues to heal (QueueAdd) after Asterisk restart.
 * Never hide an AMI leftover just because the snapshot omitted it.
 */
function planQueueMembership(amiQueues, snapshotQueues = []) {
    const ami = new Set(amiQueues.filter(Boolean));
    const missingFromAmi = snapshotQueues.filter((q) => q && !ami.has(q));
    const display = [...ami];
    for (const q of missingFromAmi)
        display.push(q);
    display.sort();
    return { display, missingFromAmi };
}
/** Union AMI membership across primary ↔ WebRTC twins onto one live agent. */
function mergeRelatedQueueMembership(queuesByInterface, relatedInterfaces) {
    const merged = new Set();
    for (const iface of relatedInterfaces) {
        const queues = queuesByInterface.get(iface);
        if (!queues)
            continue;
        for (const q of queues) {
            if (q)
                merged.add(q);
        }
    }
    return [...merged].sort();
}
//# sourceMappingURL=queue-membership.util.js.map