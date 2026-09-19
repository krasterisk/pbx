import { createHash } from 'node:crypto';
import { admitJob, emptyAdmissionStores } from './admission';
import { canonicalRequestHash, digestIdempotencyKey } from './idempotency';

const base = {
  tenantUid: 2,
  principalId: 'prin-1',
  product: 'speech_analytics',
  kind: 'analyze',
  resourceKind: 'asset',
  resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  idempotencyKey: 'op-1',
  request: { assetId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
  entitled: true,
  now: new Date('2026-09-19T00:00:00.000Z'),
};

describe('D2 admission', () => {
  it('returns 202 and replays the same key+hash', () => {
    const memory = emptyAdmissionStores();
    const first = admitJob(base, memory);
    expect(first.status).toBe(202);
    expect(first.replay).toBe(false);
    const replay = admitJob(base, memory);
    expect(replay).toEqual({ status: 202, jobId: first.jobId, replay: true });
    expect(memory.jobs.size).toBe(1);
    expect(memory.outbox.size).toBe(1);
    expect(memory.stages.size).toBe(1);
  });

  it('conflicts when the key is reused with a different hash and denies unentitled work', () => {
    const memory = emptyAdmissionStores();
    admitJob(base, memory);
    expect(() => admitJob({ ...base, request: { assetId: 'other' } }, memory)).toThrow(/different request/);
    expect(() => admitJob({ ...base, entitled: false, idempotencyKey: 'op-2' }, memory)).toThrow(/not entitled/);
  });

  it('hashes printable ASCII keys and canonical JSON', () => {
    expect(digestIdempotencyKey('A').length).toBe(32);
    expect(() => digestIdempotencyKey('')).toThrow(/ASCII/);
    expect(canonicalRequestHash({ b: 1, a: 2 })).toBe(
      createHash('sha256').update(JSON.stringify([['a', 2], ['b', 1]])).digest('hex'),
    );
  });
});
