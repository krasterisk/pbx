"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyAdmissionStores = emptyAdmissionStores;
exports.admissionKey = admissionKey;
exports.admitJob = admitJob;
exports.admitThenEnqueue = admitThenEnqueue;
exports.cancelQueuedJob = cancelQueuedJob;
const node_crypto_1 = require("node:crypto");
const idempotency_1 = require("./idempotency");
const outbox_payload_1 = require("./outbox-payload");
const state_machines_1 = require("./state-machines");
const fairness_1 = require("./fairness");
function emptyAdmissionStores() {
    return {
        idempotency: new Map(),
        jobs: new Map(),
        stages: new Map(),
        outbox: new Map(),
        events: new Map(),
    };
}
function admissionKey(row) {
    return `${row.tenantUid}:${row.principalId}:${row.namespace}:${row.keyDigest}`;
}
function cloneStores(stores) {
    return {
        idempotency: new Map(stores.idempotency),
        jobs: new Map(stores.jobs),
        stages: new Map(stores.stages),
        outbox: new Map(stores.outbox),
        events: new Map(stores.events),
    };
}
function copyStores(target, source) {
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
function replayOrConflict(existing, requestHash) {
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
function admitMutating(input, stores) {
    if (!input.entitled) {
        throw Object.assign(new Error('product is not entitled'), { code: 'product_not_entitled', status: 403 });
    }
    const keyDigest = (0, idempotency_1.digestIdempotencyKey)(input.idempotencyKey).toString('hex');
    const requestHash = (0, idempotency_1.canonicalRequestHash)(input.request);
    const namespace = `jobs.create:${input.resourceKind}`;
    const lookup = admissionKey({
        tenantUid: input.tenantUid, principalId: input.principalId, namespace, keyDigest,
    });
    const existing = stores.idempotency.get(lookup);
    if (existing) {
        return replayOrConflict(existing, requestHash);
    }
    const caps = input.caps ?? { runningCap: fairness_1.DEFAULT_RUNNING_CAP, queueCap: fairness_1.DEFAULT_QUEUE_CAP };
    let running = 0;
    let queued = 0;
    for (const job of stores.jobs.values()) {
        if (job.tenantUid !== input.tenantUid)
            continue;
        if (job.state === 'running')
            running += 1;
        if (job.state === 'queued')
            queued += 1;
    }
    (0, fairness_1.assertFairness)({ running, queued }, caps);
    const jobId = (0, node_crypto_1.randomUUID)();
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
    const stageId = (0, node_crypto_1.randomUUID)();
    stores.stages.set(stageId, {
        id: stageId, jobId, tenantUid: input.tenantUid, stageKey: 'run',
        state: 'pending', version: 1, fence: 0,
    });
    const payload = (0, outbox_payload_1.admittedJobPayload)(input.tenantUid, jobId);
    stores.outbox.set(payload.aggregateId, {
        id: (0, node_crypto_1.randomUUID)(),
        tenantUid: input.tenantUid,
        aggregateId: jobId,
        eventType: payload.eventType,
        payload: JSON.stringify(payload),
        deliveredAt: null,
        version: 1,
    });
    stores.events.set(jobId, { id: (0, node_crypto_1.randomUUID)(), jobId, eventType: 'job.admitted' });
    return { status: 202, jobId, replay: false };
}
function admitJob(input, stores, options) {
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
async function admitThenEnqueue(input, stores, queue) {
    const receipt = admitJob(input, stores);
    if (receipt.replay)
        return receipt;
    const outbox = [...stores.outbox.values()].find(row => row.aggregateId === receipt.jobId);
    try {
        if (outbox)
            await queue.enqueue(outbox.id);
    }
    catch {
        /* Redis failure does not roll back committed SQL work. */
    }
    return receipt;
}
function cancelQueuedJob(job) {
    return { ...job, state: (0, state_machines_1.transitionJob)(job.state, 'cancelled'), version: job.version + 1 };
}
//# sourceMappingURL=admission.js.map