import { resolveRequiredAiRedis } from './ai-redis.factory';
import { dedupeDelivery, dispatchOutbox } from './outbox-dispatcher';
import { FaultCapableTestProvider } from './test-provider';

describe('D2 redis/outbox/test provider', () => {
  it('requires REDIS_HOST without touching optional PBX Redis', () => {
    expect(() => resolveRequiredAiRedis({})).toThrow(/REDIS_HOST/);
    expect(resolveRequiredAiRedis({ REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379' }))
      .toEqual({ host: '127.0.0.1', port: 6379 });
  });

  it('marks delivery after enqueue and skips a replayed handler', async () => {
    const queued: string[] = [];
    const first = await dispatchOutbox(
      { id: 'evt-1', deliveredAt: null, leaseOwner: 'disp-1', attempts: 0 },
      { enqueue: async (id) => { queued.push(id); } },
      new Date('2026-09-19T00:00:00.000Z'),
    );
    expect(queued).toEqual(['evt-1']);
    expect(dedupeDelivery(first)).toBe('skip');
    const second = await dispatchOutbox(first, { enqueue: async (id) => { queued.push(id); } }, new Date());
    expect(queued).toEqual(['evt-1']);
    expect(second.deliveredAt).toEqual(first.deliveredAt);
  });

  it('records unknown instead of a second dispatch after a timeout', () => {
    const provider = new FaultCapableTestProvider('timeout');
    expect(provider.afterNetwork('dispatched')).toBe('unknown');
  });
});
