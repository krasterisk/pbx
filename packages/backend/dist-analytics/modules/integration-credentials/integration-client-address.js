"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationClientAddress = integrationClientAddress;
const node_net_1 = require("node:net");
/** Use forwarded addresses only when the immediate peer is explicitly trusted. */
function integrationClientAddress(peer, forwarded, trustedPeers) {
    const socketAddress = typeof peer === 'string' && (0, node_net_1.isIP)(peer) ? peer : 'unknown';
    const trusted = new Set((trustedPeers ?? '').split(',').map((value) => value.trim())
        .filter((value) => (0, node_net_1.isIP)(value) !== 0));
    if (!trusted.has(socketAddress) || typeof forwarded !== 'string' || forwarded.length > 4096) {
        return socketAddress;
    }
    const chain = forwarded.split(',').map((value) => value.trim());
    if (chain.some((value) => (0, node_net_1.isIP)(value) === 0))
        return socketAddress;
    for (let index = chain.length - 1; index >= 0; index--) {
        if (!trusted.has(chain[index]))
            return chain[index];
    }
    return socketAddress;
}
//# sourceMappingURL=integration-client-address.js.map