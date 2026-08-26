import { HTTP_RESULT_VAR, type IHttpRequestParams } from '@krasterisk/shared';
import { buildCurlCall, type BuildCurlCallCtx } from './dialplan-curl.util';

export const HTTP_REQUEST_DEFAULT_TIMEOUT = 5;
export const HTTP_STATUS_VAR = 'KRSK_HTTP_STATUS';

export const ALLOWED_HTTP_HEADER_KEYS = [
  'Accept',
  'Content-Type',
  'Authorization',
  'X-Request-Id',
] as const;

const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;

function sanitizeDialplanInput(input?: string): string {
  if (!input) return '';
  return input.replace(DIALPLAN_UNSAFE, '').trim();
}

function allowlistHosts(): Set<string> {
  const raw = process.env.DIALPLAN_HTTP_INTERNAL_HOSTS ?? '';
  return new Set(
    raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  );
}

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function parseIpv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((n) => n > 255)) return null;
  return parts;
}

function isPrivateIpv4(parts: number[]): boolean {
  const n = ipv4ToInt(parts);
  const inRange = (base: number, mask: number) => (n & mask) === base;
  return (
    inRange(ipv4ToInt([10, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0]))
    || inRange(ipv4ToInt([172, 16, 0, 0]), ipv4ToInt([255, 240, 0, 0]))
    || inRange(ipv4ToInt([192, 168, 0, 0]), ipv4ToInt([255, 255, 0, 0]))
    || inRange(ipv4ToInt([127, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0]))
    || inRange(ipv4ToInt([169, 254, 0, 0]), ipv4ToInt([255, 255, 0, 0]))
    || inRange(ipv4ToInt([0, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0]))
  );
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  if (h.startsWith('fe80:') || h.startsWith('feb')) return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length);
    const parts = parseIpv4(mapped);
    return !parts || isPrivateIpv4(parts);
  }
  return false;
}

export function assertSafeHttpUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('invalid HTTP URL');
  }
  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('HTTP URL scheme must be https');
  }
  if (protocol === 'http:' && !allowlistHosts().has(host)) {
    throw new Error('http is only allowed for configured internal hosts');
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') {
    throw new Error('HTTP URL host is not allowed');
  }
  const ipv4 = parseIpv4(host);
  if (ipv4 && isPrivateIpv4(ipv4)) {
    throw new Error('HTTP URL must not target a private or metadata address');
  }
  if (host.includes(':') && isBlockedIpv6(host)) {
    throw new Error('HTTP URL must not target a private or metadata address');
  }
}

export interface EmitHttpRequestCtx {
  curlCtx?: BuildCurlCallCtx;
  actionId?: string;
}

export function emitHttpRequest(
  params: IHttpRequestParams,
  ctx: EmitHttpRequestCtx = {},
): string {
  const url = String(params.url ?? '');
  assertSafeHttpUrl(url);
  const timeout = Number(params.timeout);
  const seconds = Number.isFinite(timeout) && timeout > 0
    ? Math.min(Math.floor(timeout), 60)
    : HTTP_REQUEST_DEFAULT_TIMEOUT;
  const method = params.method === 'POST' ? 'POST' : 'GET';
  const safeUrl = sanitizeDialplanInput(url);
  const payload: Record<string, string> = {
    url: safeUrl,
    method,
    timeout: String(seconds),
    route_uid: '${HH_ROUTE_UID}',
  };
  if (ctx.actionId) {
    payload.action_id = sanitizeDialplanInput(ctx.actionId);
  }
  if (method === 'POST') {
    payload.body = sanitizeDialplanInput(params.body);
  }

  const curl = buildCurlCall('http-request', payload, {
    ...ctx.curlCtx,
    timeoutSec: seconds,
  });
  const lines = [
    curl,
    `ExecIf($["\${${HTTP_RESULT_VAR}}" = ""]?Set(${HTTP_STATUS_VAR}=timeout))`,
    `ExecIf($["\${${HTTP_RESULT_VAR}}" != ""]?Set(${HTTP_STATUS_VAR}=ok))`,
  ];
  return lines.join('\nsame => n,');
}

export function pickAllowedHttpHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!(ALLOWED_HTTP_HEADER_KEYS as readonly string[]).includes(key)) continue;
    out[key] = String(value ?? '');
  }
  return out;
}
