import { randomUUID } from 'node:crypto';
import { canonicalRequestHash, digestIdempotencyKey } from './idempotency';
import { admittedJobPayload } from './outbox-payload';
import { transitionJob, type JobState } from './state-machines';
import { assertFairness, DEFAULT_QUEUE_CAP, DEFAULT_RUNNING_CAP, type FairnessCaps } from './fairness';

export type AdmissionRequest = {
  tenantUid: number;
  principalId: string;
  product: string;
  kind: string;
  resourceKind: string;
  resourceId: string;
  idempotencyKey: string;
  request: Record<string, unknown>;
  entitled: boolean;
  now: Date;
  caps?: FairnessCaps;
};

export type AdmissionReceipt = {
  status: 202;
  jobId: string;
  replay: boolean;
};

export type AdmissionOptions = {
  crash?: 'before-commit' | 'after-commit';
};

export type IdempotencyRow = {
  tenantUid: number;
  principalId: string;
  namespace: string;
  keyDigest: string;
  requestHash: string;
  state: 'started' | 'completed';
  resourceId: string | null;
};

export type JobRow = {
  id: string;
  tenantUid: number;
  state: JobState;
  version: number;
};

export type StageRow = {
  id: string;
  jobId: string;
  tenantUid: number;
  stageKey: string;
  state: 'pending' | 'leased' | 'executing' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';
  version: number;
  fence: number;
};

export type OutboxRow = {
  id: string;
  tenantUid: number;
  aggregateId: string;
  eventType: string;
  payload: string;
  deliveredAt: Date | null;
  version: number;
};

export type JobEventRow = {
  id: string;
  jobId: string;
  eventType: string;
};

export type AdmissionStores = {
  idempotency: Map<string, IdempotencyRow>;
  jobs: Map<string, JobRow>;
  stages: Map<string, StageRow>;
  outbox: Map<string, OutboxRow>;
  events: Map<string, JobEventRow>;
};

export function emptyAdmissionStores(): AdmissionStores {
  return {
    idempotency: new Map(),
    jobs: new Map(),
    stages: new Map(),
    outbox: new Map(),
    events: new Map(),
  };
}

export function admissionKey(row: Pick<IdempotencyRow, 'tenantUid' | 'principalId' | 'namespace' | 'keyDigest'>): string {
  return `${row.tenantUid}:${row.principalId}:${row.namespace}:${row.keyDigest}`;
}

function cloneStores(stores: AdmissionStores): AdmissionStores {
  return {
    idempotency: new Map(stores.idempotency),
    jobs: new Map(stores.jobs),
    stages: new Map(stores.stages),
    outbox: new Map(stores.outbox),
    events: new Map(stores.events),
  };
}

function copyStores(target: AdmissionStores, source: AdmissionStores): void {
  target.idempotency.clear();
  target.jobs.clear();
  target.stages.clear();
  target.outbox.clear();
  target.events.clear();
  source.idempotency.forEach((value, key) => target.idempotency.set(key, value));
  source.jobs.forEach((value, key) => target.jobs.set(key, value));
  source.stages.forEach((value, key) => target.stages.set(key, value));
  source.outbox.forEach((value, key) => target.outbox.set(key, value));
  source.events.forEach((value, key) => target.events.set(key, value));
}

function replayOrConflict(existing: IdempotencyRow, requestHash: string): AdmissionReceipt {
  if (existing.requestHash !== requestHash) {
    throw Object.assign(new Error('Idempotency-Key reused with a different request'), {
      code: 'idempotency_conflict', status: 409,
    });
  }
  if (existing.state !== 'completed' || !existing.resourceId) {
    throw Object.assign(new Error('idempotency row is incomplete'), {
      code: 'idempotency_in_progress', status: 503,
    });
  }
  return { status: 202, jobId: existing.resourceId, replay: true };
}

function admitMutating(input: AdmissionRequest, stores: AdmissionStores): AdmissionReceipt {
  if (!input.entitled) {
    throw Object.assign(new Error('product is not entitled'), { code: 'product_not_entitled', status: 403 });
  }
  const keyDigest = digestIdempotencyKey(input.idempotencyKey).toString('hex');
  const requestHash = canonicalRequestHash(input.request);
  const namespace = `jobs.create:${input.resourceKind}`;
  const lookup = admissionKey({
    tenantUid: input.tenantUid, principalId: input.principalId, namespace, keyDigest,
  });
  const existing = stores.idempotency.get(lookup);
  if (existing) {
    return replayOrConflict(existing, requestHash);
  }
  const caps = input.caps ?? { runningCap: DEFAULT_RUNNING_CAP, queueCap: DEFAULT_QUEUE_CAP };
  let running = 0;
  let queued = 0;
  for (const job of stores.jobs.values()) {
    if (job.tenantUid !== input.tenantUid) continue;
    if (job.state === 'running') running += 1;
    if (job.state === 'queued') queued += 1;
  }
  assertFairness({ running, queued }, caps);
  const jobId = randomUUID();
  stores.idempotency.set(lookup, {
    tenantUid: input.tenantUid,
    principalId: input.principalId,
    namespace,
    keyDigest,
    requestHash,
    state: 'completed',
    resourceId: jobId,
  });
  stores.jobs.set(jobId, { id: jobId, tenantUid: input.tenantUid, state: 'queued', version: 1 });
  const stageId = randomUUID();
  stores.stages.set(stageId, {
    id: stageId, jobId, tenantUid: input.tenantUid, stageKey: 'run',
    state: 'pending', version: 1, fence: 0,
  });
  const payload = admittedJobPayload(input.tenantUid, jobId);
  stores.outbox.set(payload.aggregateId, {
    id: randomUUID(),
    tenantUid: input.tenantUid,
    aggregateId: jobId,
    eventType: payload.eventType,
    payload: JSON.stringify(payload),
    deliveredAt: null,
    version: 1,
  });
  stores.events.set(jobId, { id: randomUUID(), jobId, eventType: 'job.admitted' });
  return { status: 202, jobId, replay: false };
}

export function admitJob(
  input: AdmissionRequest,
  stores: AdmissionStores,
  options?: AdmissionOptions,
): AdmissionReceipt {
  const working = cloneStores(stores);
  const receipt = admitMutating(input, working);
  if (options?.crash === 'before-commit') {
    throw Object.assign(new Error('crash before commit'), { code: 'crash_before_commit' });
  }
  copyStores(stores, working);
  if (options?.crash === 'after-commit') {
    throw Object.assign(new Error('crash after commit'), { code: 'crash_after_commit', receipt });
  }
  return receipt;
}

export async function admitThenEnqueue(
  input: AdmissionRequest,
  stores: AdmissionStores,
  queue: { enqueue: (id: string) => Promise<void> },
): Promise<AdmissionReceipt> {
  const receipt = admitJob(input, stores);
  if (receipt.replay) return receipt;
  const outbox = [...stores.outbox.values()].find(row => row.aggregateId === receipt.jobId);
  try {
    if (outbox) await queue.enqueue(outbox.id);
  } catch {
    /* Redis failure does not roll back committed SQL work. */
  }
  return receipt;
}

export function cancelQueuedJob(job: JobRow): JobRow {
  return { ...job, state: transitionJob(job.state, 'cancelled'), version: job.version + 1 };
}
