"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDEMPOTENCY_STATES = exports.PROVIDER_OPERATION_STATES = exports.STAGE_STATES = exports.JOB_STATES = void 0;
exports.canTransitionJob = canTransitionJob;
exports.transitionJob = transitionJob;
exports.requestJobCancel = requestJobCancel;
exports.canTransitionStage = canTransitionStage;
exports.transitionStage = transitionStage;
exports.completeStage = completeStage;
exports.canTransitionProviderOperation = canTransitionProviderOperation;
exports.transitionProviderOperation = transitionProviderOperation;
exports.recoverProviderDispatch = recoverProviderDispatch;
exports.nextProviderOrdinal = nextProviderOrdinal;
exports.compareAndSwapVersion = compareAndSwapVersion;
exports.replayIdempotency = replayIdempotency;
exports.JOB_STATES = [
    'queued', 'running', 'succeeded', 'failed', 'cancelled',
    'retry_wait', 'awaiting_reconciliation', 'blocked',
];
const JOB_TRANSITIONS = {
    queued: ['running', 'cancelled', 'blocked'],
    running: ['succeeded', 'failed', 'cancelled', 'retry_wait', 'awaiting_reconciliation', 'blocked'],
    retry_wait: ['queued', 'cancelled'],
    awaiting_reconciliation: ['succeeded', 'failed', 'cancelled'],
    blocked: ['queued', 'cancelled'],
    succeeded: [],
    failed: [],
    cancelled: [],
};
function canTransitionJob(from, to) {
    return JOB_TRANSITIONS[from].includes(to);
}
function transitionJob(from, to) {
    if (!canTransitionJob(from, to)) {
        throw new Error(`illegal job transition ${from}->${to}`);
    }
    return to;
}
function requestJobCancel(job, at) {
    if (job.state === 'queued') {
        return { ...job, state: 'cancelled', cancel_requested_at: at };
    }
    if (job.state === 'succeeded' || job.state === 'failed' || job.state === 'cancelled') {
        throw new Error(`illegal cancel request in ${job.state}`);
    }
    return { ...job, cancel_requested_at: at };
}
exports.STAGE_STATES = [
    'pending', 'leased', 'executing', 'succeeded', 'failed', 'cancelled', 'unknown',
];
const STAGE_TRANSITIONS = {
    pending: ['leased', 'cancelled'],
    leased: ['executing', 'pending', 'cancelled'],
    executing: ['succeeded', 'failed', 'cancelled', 'unknown'],
    unknown: ['succeeded', 'failed', 'cancelled'],
    succeeded: [],
    failed: [],
    cancelled: [],
};
function canTransitionStage(from, to) {
    return STAGE_TRANSITIONS[from].includes(to);
}
function transitionStage(from, to) {
    if (!canTransitionStage(from, to)) {
        throw new Error(`illegal stage transition ${from}->${to}`);
    }
    return to;
}
function completeStage(current, to, outputDigest, previousOutputDigest) {
    if (current === 'succeeded') {
        if (to !== 'succeeded' || outputDigest !== previousOutputDigest) {
            throw new Error('succeeded stage is immutable');
        }
        return 'succeeded';
    }
    return transitionStage(current, to);
}
exports.PROVIDER_OPERATION_STATES = [
    'prepared', 'dispatched', 'observed_success', 'observed_failure',
    'unknown', 'reconciled_success', 'reconciled_failure',
];
const PROVIDER_TRANSITIONS = {
    prepared: ['dispatched'],
    dispatched: ['observed_success', 'observed_failure', 'unknown'],
    observed_success: ['reconciled_success'],
    observed_failure: ['reconciled_failure'],
    unknown: ['reconciled_success', 'reconciled_failure'],
    reconciled_success: [],
    reconciled_failure: [],
};
function canTransitionProviderOperation(from, to) {
    return PROVIDER_TRANSITIONS[from].includes(to);
}
function transitionProviderOperation(from, to) {
    if (!canTransitionProviderOperation(from, to)) {
        throw new Error(`illegal provider operation transition ${from}->${to}`);
    }
    return to;
}
/** Crash after dispatch is recorded as unknown; never a blind second dispatch. */
function recoverProviderDispatch(state) {
    if (state === 'prepared') {
        return 'dispatched';
    }
    if (state === 'dispatched') {
        return transitionProviderOperation(state, 'unknown');
    }
    throw new Error(`illegal provider dispatch recovery from ${state}`);
}
function nextProviderOrdinal(current, reason) {
    if (reason === 'worker_restart') {
        if (current === null) {
            throw new Error('worker restart without an existing ordinal');
        }
        return current;
    }
    return (current ?? 0) + 1;
}
function compareAndSwapVersion(current, expected) {
    if (current !== expected) {
        throw new Error('cas collision');
    }
    return current + 1;
}
exports.IDEMPOTENCY_STATES = ['started', 'completed'];
function replayIdempotency(input) {
    if (input.storedHash !== input.requestHash) {
        return 'conflict';
    }
    return 'same';
}
//# sourceMappingURL=state-machines.js.map