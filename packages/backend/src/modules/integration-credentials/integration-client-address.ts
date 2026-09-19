import { isIP } from 'node:net';

/** Use forwarded addresses only when the immediate peer is explicitly trusted. */
export function integrationClientAddress(
  peer: string | undefined, forwarded: unknown, trustedPeers: string | undefined,
): string {
  const socketAddress = typeof peer === 'string' && isIP(peer) ? peer : 'unknown';
  const trusted = new Set((trustedPeers ?? '').split(',').map((value) => value.trim())
    .filter((value) => isIP(value) !== 0));
  if (!trusted.has(socketAddress) || typeof forwarded !== 'string' || forwarded.length > 4096) {
    return socketAddress;
  }
  const chain = forwarded.split(',').map((value) => value.trim());
  if (chain.some((value) => isIP(value) === 0)) return socketAddress;
  for (let index = chain.length - 1; index >= 0; index--) {
    if (!trusted.has(chain[index])) return chain[index];
  }
  return socketAddress;
}
