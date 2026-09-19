import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ?? code);
  }
}

export type WebhookEnvelope = {
  eventId: string;
  schemaVersion: 1;
  time: string;
  projectId: string;
  runId: string;
  externalCallId: string;
  resultUrl: string;
  eventType: 'completed' | 'partial' | 'failed' | 'cancelled';
};

export function signEnvelope(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyEnvelope(input: {
  secret: string; timestamp: string; rawBody: string; signature: string; now: Date;
}): boolean {
  const age = Math.abs(input.now.getTime() - Date.parse(input.timestamp));
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;
  const expected = signEnvelope(input.secret, input.timestamp, input.rawBody);
  return expected === input.signature;
}

export function assertSafeWebhookUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new DomainError('webhook_url_invalid', 422); }
  if (url.protocol !== 'https:') throw new DomainError('webhook_https_required', 422);
  if (url.username || url.password) throw new DomainError('webhook_credentials_forbidden', 422);
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') {
    throw new DomainError('webhook_ssrf_denied', 422);
  }
  if (isIP(host) && isBlockedIp(host)) throw new DomainError('webhook_ssrf_denied', 422);
  return url;
}

export function isBlockedIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) {
    return true;
  }
  const match = /^172\.(\d+)\./.exec(ip);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (ip.startsWith('100.64.')) return true;
  return false;
}

export function buildEnvelope(input: Omit<WebhookEnvelope, 'schemaVersion' | 'eventId'> & { eventId?: string }): WebhookEnvelope {
  return { schemaVersion: 1, eventId: input.eventId ?? randomUUID(), ...input };
}

export function nextAttemptDelayMs(attempt: number): number {
  const base = Math.min(24 * 60 * 60 * 1000, 1000 * (2 ** Math.min(attempt, 8)));
  return Math.floor(base * (0.8 + Math.random() * 0.4));
}
