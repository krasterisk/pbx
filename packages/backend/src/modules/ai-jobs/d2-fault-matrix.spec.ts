import { UniqueConstraintError } from 'sequelize';
import { admitJob, admitThenEnqueue, emptyAdmissionStores } from './admission';
import { AiJobAdmissionService } from './ai-job-admission.service';
import { createAiOutboxQueue } from './ai-bullmq.factory';
import { assertAiRedisReady } from './ai-redis.factory';
import { applyJobCancel, allowNextStage, mayClaimStage } from './cancel-policy';
import { applyStageRetry } from './stage-retry';
import { nextProviderOrdinal } from './state-machines';
import { canonicalRequestHash } from './idempotency';
import { dispatchOutbox, handleQueueEvent } from './outbox-dispatcher';
import { assertQueueTenant, bindAiQueueJob } from './queue-payload';
import { reconcileExpiredLease, reconcileOutbox, reconcileUnknownOperation } from './reconciler';
import { classifyProviderError, nextRetryDelayMs } from './retry-budget';
import { casWon, stageClaimSql } from './sql-cas';
import { claimStage, commitStage, startStageExecution, type StageLease } from './stage-lease';
import { FaultCapableTestProvider } from './test-provider';

const now = new Date('2026-09-19T00:00:00.000Z');
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
  now,
};

function pendingStage(): StageLease {
  return {
    id: 'stage-1', tenantUid: 2, state: 'pending', version: 1, fence: 0,
    leaseOwner: null, leaseUntil: null,
  };
}

describe('D2 fault matrix (local contracts)', () => {
  it('rolls back work killed before SQL commit and keeps work killed after commit', async () => {
    const stores = emptyAdmissionStores();
    expect(() => admitJob(base, stores, { crash: 'before-commit' })).toThrow(/crash before commit/);
    expect(stores.jobs.size).toBe(0);
    expect(() => admitJob(base, stores, { crash: 'after-commit' })).toThrow(/crash after commit/);
    expect(stores.jobs.size).toBe(1);
    await admitThenEnqueue(
      { ...base, idempotencyKey: 'op-2' },
      stores,
      { enqueue: async () => { throw new Error('redis down'); } },
    );
    expect(stores.jobs.size).toBe(2);
    expect([...stores.outbox.values()].every(row => row.deliveredAt == null)).toBe(true);
  });

  it('enqueues before marking delivery and skips a duplicate handler', async () => {
    const processed = new Set<string>();
    const queued: string[] = [];
    const record = { id: 'evt-1', deliveredAt: null as Date | null, leaseOwner: 'dispatcher-1', attempts: 0 };
    await expect(dispatchOutbox(record, { enqueue: async (id) => { queued.push(id); } }, now, 'after-enqueue'))
      .rejects.toThrow(/crash after enqueue/);
    expect(queued).toEqual(['evt-1']);
    expect(handleQueueEvent(processed, 'evt-1')).toBe('apply');
    const delivered = await dispatchOutbox(record, { enqueue: async (id) => { queued.push(id); } }, now);
    expect(handleQueueEvent(processed, delivered.id)).toBe('skip');
    expect(queued).toEqual(['evt-1', 'evt-1']);
  });

  it('lets only the matching fence commit and serializes simultaneous claims', () => {
    const leased = claimStage(pendingStage(), {
      owner: 'worker-alpha', expectedVersion: 1, now, leaseMs: 30000,
    });
    const executing = startStageExecution(leased, { owner: 'worker-alpha', fence: 1 });
    expect(() => commitStage(executing, { owner: 'worker-stale', fence: 1, to: 'succeeded' }))
      .toThrow(/stale fence/);
    expect(commitStage(executing, { owner: 'worker-alpha', fence: 1, to: 'succeeded' }).state).toBe('succeeded');
    const first = claimStage(pendingStage(), { owner: 'worker-one', expectedVersion: 1, now, leaseMs: 30000 });
    expect(() => claimStage(first, { owner: 'worker-two', expectedVersion: 1, now, leaseMs: 30000 }))
      .toThrow(/cas collision/);
  });

  it('enforces tenant fairness, cancel, and forged queue payloads', () => {
    const stores = emptyAdmissionStores();
    admitJob({ ...base, caps: { runningCap: 1, queueCap: 1 } }, stores);
    expect(() => admitJob({ ...base, idempotencyKey: 'op-2', caps: { runningCap: 1, queueCap: 1 } }, stores))
      .toThrow(/fairness/);
    const cancelled = applyJobCancel(
      { state: 'queued', cancel_requested_at: null },
      { state: 'pending' },
      now,
    );
    expect(cancelled.job.state).toBe('cancelled');
    expect(cancelled.allowProviderCall).toBe(false);
    const running = applyJobCancel(
      { state: 'running', cancel_requested_at: null },
      { state: 'executing' },
      now,
    );
    expect(running.job.cancel_requested_at).toEqual(now);
    expect(allowNextStage(running.job)).toBe(false);
    expect(mayClaimStage(running.job, { state: 'pending' })).toBe(false);
    expect(mayClaimStage({ state: 'queued', cancel_requested_at: null }, { state: 'pending' })).toBe(true);
    const payload = bindAiQueueJob({
      eventId: 'evt-1', tenantUid: 2, aggregateKind: 'job', aggregateId: 'job-1',
    });
    expect(() => assertQueueTenant(payload, 9)).toThrow(/forged queue payload/);
  });

  it('holds unknown provider work, bounds retries, and requires AI Redis', async () => {
    const provider = new FaultCapableTestProvider('timeout');
    expect(provider.afterNetwork('dispatched')).toBe('unknown');
    expect(reconcileUnknownOperation('unknown')).toBe('lookup');
    expect(classifyProviderError('protocol')).toBe('fail');
    expect(nextRetryDelayMs(3)).toBeNull();
    expect(nextRetryDelayMs(0, () => 0)).toBe(1000);
    const pending = {
      state: 'pending' as const, attemptCount: 3, errorCode: null, nextRunAt: null, leaseOwner: null, leaseUntil: null,
    };
    expect(applyStageRetry(pending, 'transient', now, () => 0).errorCode).toBe('dlq');
    expect(applyStageRetry({ ...pending, attemptCount: 0 }, 'protocol', now).errorCode).toBe('permanent');
    expect(nextProviderOrdinal(1, 'worker_restart')).toBe(1);
    expect(nextProviderOrdinal(1, 'new_external_call')).toBe(2);
    expect(reconcileOutbox({ deliveredAt: null, leaseUntil: null }, now)).toBe('dispatch');
    expect(reconcileExpiredLease({
      state: 'leased', leaseOwner: 'worker-alpha', leaseUntil: now, fence: 1,
    }, now)?.state).toBe('pending');
    expect(() => createAiOutboxQueue({})).toThrow(/REDIS_HOST/);
    expect(createAiOutboxQueue({ REDIS_HOST: '127.0.0.1' })).toEqual({
      name: 'ai-outbox', connection: { host: '127.0.0.1', port: 6379 },
    });
    await expect(assertAiRedisReady(async () => 'NO')).rejects.toThrow(/ping/);
    await assertAiRedisReady(async () => 'PONG');
  });

  it('interprets dialect CAS winners and admits inside one SQL transaction', async () => {
    expect(casWon('postgres', [{ id: 'stage-1' }])).toBe(true);
    expect(casWon('postgres', [])).toBe(false);
    expect(casWon('mysql', { affectedRows: 1 })).toBe(true);
    expect(casWon('mysql', { affectedRows: 0 })).toBe(false);
    expect(stageClaimSql('postgres')).toMatch(/RETURNING id/);
    expect(stageClaimSql('mysql')).not.toMatch(/RETURNING/);
    const hash = canonicalRequestHash(base.request);
    const idempotency = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          request_hash: hash, state: 'completed', resource_id: 'job-replay',
        }),
      create: jest.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new UniqueConstraintError({ errors: [] })),
      update: jest.fn().mockResolvedValue([1]),
    };
    const jobs = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    };
    const stages = { create: jest.fn().mockResolvedValue({}) };
    const outbox = { create: jest.fn().mockResolvedValue({}) };
    const events = { create: jest.fn().mockResolvedValue({}) };
    const sequelize = {
      transaction: jest.fn(async (fn: (tx: { LOCK: { UPDATE: string } }) => Promise<unknown>) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
    };
    const service = new AiJobAdmissionService(
      sequelize as never, idempotency as never, jobs as never,
      stages as never, outbox as never, events as never,
    );
    const created = await service.admit(base);
    expect(created.status).toBe(202);
    expect(created.replay).toBe(false);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(jobs.create).toHaveBeenCalled();
    const replayed = await service.admit({ ...base, idempotencyKey: 'op-race' });
    expect(replayed).toEqual({ status: 202, jobId: 'job-replay', replay: true });
    expect(jobs.create).toHaveBeenCalledTimes(1);
  });
});
