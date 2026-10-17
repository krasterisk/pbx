import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

export function isAutodialPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export function autodialWebhookUrl(raw: string): URL {
  let url: URL; try { url = new URL(raw); } catch { throw new Error('AC_WEBHOOK_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')
    || url.hostname.includes(':') || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    || (isIP(url.hostname) && !isAutodialPublicIpv4(url.hostname))) throw new Error('AC_WEBHOOK_URL');
  return url;
}
export async function sendAutodialWebhook(raw: string, body: string, headers: Record<string, string>): Promise<number> {
  const url = autodialWebhookUrl(raw);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error('AC_WEBHOOK_DNS_TIMEOUT')), 5000); })])
    .finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((item) => !isAutodialPublicIpv4(item.address))) throw new Error('AC_WEBHOOK_ADDRESS');
  // Pin the validated address for this connection; no redirects or second DNS lookup.
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', timeout: 5000, agent: false, family: 4,
      lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4),
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) } }, (res) => {
      const status = res.statusCode ?? 0; res.destroy(); clearTimeout(timer); resolve(status);
    });
    const timer = setTimeout(() => req.destroy(new Error('AC_WEBHOOK_TIMEOUT')), 5000);
    req.on('error', (error) => { clearTimeout(timer); reject(error); });
    req.on('timeout', () => req.destroy(new Error('AC_WEBHOOK_TIMEOUT'))); req.end(body);
  });
}
