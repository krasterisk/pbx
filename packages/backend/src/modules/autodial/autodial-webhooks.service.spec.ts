import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { AutodialWebhooksService } from './autodial-webhooks.service';
import { sendAutodialWebhook } from './autodial-webhook-http';

jest.mock('./autodial-webhook-http', () => ({
  ...jest.requireActual('./autodial-webhook-http'), sendAutodialWebhook: jest.fn(),
}));

describe('Autodial durable webhook worker', () => {
  const send = jest.mocked(sendAutodialWebhook);
  function fixture(count = 0) {
    const delivery = { uid: 'delivery-1', webhook_uid: 'hook-1', vpbx_user_uid: 7, attempt_count: count,
      payload: JSON.stringify({ schema_version: 1, data: { external_id: 'synthetic', disposition: 'success' } }) };
    const hook = { enabled: true, key_uid: 'key-1', url: 'https://crm.example.com/events', secret_cipher: '' };
    const db = { getDialect: () => 'mysql', query: jest.fn(), transaction: jest.fn(async (_options, work) => work({})) };
    const keys = { assertActive: jest.fn().mockResolvedValue(undefined) };
    const service = new AutodialWebhooksService(db as never, new ConfigService({ JWT_SECRET: 'synthetic-jwt-secret-32-characters-long' }), keys as never);
    hook.secret_cipher = service['encrypt']('synthetic-webhook-secret');
    db.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT * FROM ac_webhook_deliveries') ? [delivery]
      : sql.startsWith('SELECT * FROM ac_webhooks') ? [hook] : []);
    return { service, db, keys, delivery, hook, patch: () => db.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))?.[1].replacements };
  }
  beforeEach(() => { send.mockReset(); jest.useFakeTimers().setSystemTime(new Date('2026-10-16T18:00:00Z')); });
  afterEach(() => jest.useRealTimers());
  it('signs exact raw body and records a successful delivery', async () => {
    const f = fixture(); send.mockResolvedValue(204); await f.service.deliverNext();
    const [url, body, headers] = send.mock.calls[0];
    expect(url).toBe(f.hook.url); expect(body).toBe(f.delivery.payload);
    expect(headers['X-Krasterisk-Event-Id']).toBe(f.delivery.uid);
    expect(headers['X-Krasterisk-Signature']).toBe('sha256=' + createHmac('sha256', 'synthetic-webhook-secret')
      .update(`${headers['X-Krasterisk-Timestamp']}.${body}`).digest('hex'));
    expect(f.patch()).toMatchObject({ state: 'delivered', count: 1, status: 204 });
  });
  it('persists exponential retry after network failure, without acknowledging delivery', async () => {
    const f = fixture(2); send.mockRejectedValue(new Error('timeout')); await f.service.deliverNext();
    expect(f.patch()).toMatchObject({ state: 'pending', count: 3, status: null, completed: null });
    expect(f.patch().next).toContain('18:02:00');
  });
  it('does not follow a redirect and stops after eight attempts', async () => {
    const f = fixture(7); send.mockResolvedValue(302); await f.service.deliverNext();
    expect(send).toHaveBeenCalledTimes(1); expect(f.patch()).toMatchObject({ state: 'failed', count: 8, status: 302 });
  });
  it.each(['revoked', 'disabled'])('cancels %s credentials without any HTTP request', async (reason) => {
    const f = fixture(); if (reason === 'revoked') f.keys.assertActive.mockRejectedValue(new Error('revoked')); else f.hook.enabled = false;
    await f.service.deliverNext(); expect(send).not.toHaveBeenCalled(); expect(f.patch()).toMatchObject({ state: 'cancelled' });
  });
  it('keeps work pending when database transaction fails and releases its worker lock', async () => {
    const f = fixture(); f.db.transaction.mockRejectedValueOnce(new Error('database disconnected'));
    await f.service.deliverNext(); expect(send).not.toHaveBeenCalled();
    send.mockResolvedValue(200); await f.service.deliverNext(); expect(f.patch()).toMatchObject({ state: 'delivered' });
  });
});
