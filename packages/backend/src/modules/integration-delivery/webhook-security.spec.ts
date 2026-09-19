import {
  assertSafeWebhookUrl, isBlockedIp, signEnvelope, verifyEnvelope, buildEnvelope,
} from './webhook-security';

describe('AN4 webhook signatures and SSRF', () => {
  const now = new Date('2026-09-19T12:00:00.000Z');

  it('signs the exact body and rejects a stale timestamp', () => {
    const raw = JSON.stringify(buildEnvelope({
      time: now.toISOString(), projectId: 'p', runId: 'r', externalCallId: 'c',
      resultUrl: '/api/speech-analytics/analysis-runs/r/result', eventType: 'completed',
    }));
    const timestamp = now.toISOString();
    const signature = signEnvelope('s3cret', timestamp, raw);
    expect(verifyEnvelope({ secret: 's3cret', timestamp, rawBody: raw, signature, now })).toBe(true);
    expect(verifyEnvelope({
      secret: 's3cret', timestamp, rawBody: raw + ' ', signature, now,
    })).toBe(false);
    expect(verifyEnvelope({
      secret: 's3cret', timestamp: '2026-09-19T11:00:00.000Z', rawBody: raw, signature, now,
    })).toBe(false);
  });

  it('denies private, loopback, metadata and credentialed URLs', () => {
    expect(() => assertSafeWebhookUrl('http://example.test/hook')).toThrow(/https/);
    expect(() => assertSafeWebhookUrl('https://user:pass@example.test/hook')).toThrow(/credentials/);
    expect(() => assertSafeWebhookUrl('https://127.0.0.1/hook')).toThrow(/ssrf/);
    expect(() => assertSafeWebhookUrl('https://169.254.169.254/latest')).toThrow(/ssrf/);
    expect(() => assertSafeWebhookUrl('https://localhost/hook')).toThrow(/ssrf/);
    expect(isBlockedIp('10.0.0.4')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });
});
