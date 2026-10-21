import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class EgressError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type LookupFn = (host: string) => Promise<string[]>;

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata']);

export function isBlockedAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function assertEgressUrl(raw: string, resolve: LookupFn = defaultLookup, allowHttp = false): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new EgressError('egress_url'); }
  if (url.username || url.password) throw new EgressError('egress_url');
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) throw new EgressError('egress_scheme');
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new EgressError('egress_private');
  }
  if (isIP(host) && isBlockedAddress(host)) throw new EgressError('egress_private');
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (!addresses.length || addresses.some(isBlockedAddress)) throw new EgressError('egress_private');
  return url;
}

async function defaultLookup(host: string): Promise<string[]> {
  const rows = await lookup(host, { all: true, verbatim: true });
  return rows.map(row => row.address);
}
