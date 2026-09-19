export const JOB_STATES = [
  'queued', 'running', 'succeeded', 'failed', 'cancelled',
  'retry_wait', 'awaiting_reconciliation', 'blocked',
] as const;
export type JobState = typeof JOB_STATES[number];

const JOB_TRANSITIONS: Record<JobState, readonly JobState[]> = {
  queued: ['running', 'cancelled', 'blocked'],
  running: ['succeeded', 'failed', 'cancelled', 'retry_wait', 'awaiting_reconciliation', 'blocked'],
  retry_wait: ['queued', 'cancelled'],
  awaiting_reconciliation: ['succeeded', 'failed', 'cancelled'],
  blocked: ['queued', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function transitionJob(from: JobState, to: JobState): JobState {
  if (!canTransitionJob(from, to)) {
    throw new Error(`illegal job transition ${from}->${to}`);
  }
  return to;
}

export function requestJobCancel<T extends { state: JobState; cancel_requested_at: Date | null }>(
  job: T,
  at: Date,
): T {
  if (job.state === 'queued') {
    return { ...job, state: 'cancelled', cancel_requested_at: at };
  }
  if (job.state === 'succeeded' || job.state === 'failed' || job.state === 'cancelled') {
    throw new Error(`illegal cancel request in ${job.state}`);
  }
  return { ...job, cancel_requested_at: at };
}

export const STAGE_STATES = [
  'pending', 'leased', 'executing', 'succeeded', 'failed', 'cancelled', 'unknown',
] as const;
export type StageState = typeof STAGE_STATES[number];

const STAGE_TRANSITIONS: Record<StageState, readonly StageState[]> = {
  pending: ['leased', 'cancelled'],
  leased: ['executing', 'pending', 'cancelled'],
  executing: ['succeeded', 'failed', 'cancelled', 'unknown'],
  unknown: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionStage(from: StageState, to: StageState): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

export function transitionStage(from: StageState, to: StageState): StageState {
  if (!canTransitionStage(from, to)) {
    throw new Error(`illegal stage transition ${from}->${to}`);
  }
  return to;
}

export function completeStage(
  current: StageState,
  to: 'succeeded' | 'failed' | 'cancelled',
  outputDigest?: string,
  previousOutputDigest?: string,
): StageState {
  if (current === 'succeeded') {
    if (to !== 'succeeded' || outputDigest !== previousOutputDigest) {
      throw new Error('succeeded stage is immutable');
    }
    return 'succeeded';
  }
  return transitionStage(current, to);
}

export const PROVIDER_OPERATION_STATES = [
  'prepared', 'dispatched', 'observed_success', 'observed_failure',
  'unknown', 'reconciled_success', 'reconciled_failure',
] as const;
export type ProviderOperationState = typeof PROVIDER_OPERATION_STATES[number];

const PROVIDER_TRANSITIONS: Record<ProviderOperationState, readonly ProviderOperationState[]> = {
  prepared: ['dispatched'],
  dispatched: ['observed_success', 'observed_failure', 'unknown'],
  observed_success: ['reconciled_success'],
  observed_failure: ['reconciled_failure'],
  unknown: ['reconciled_success', 'reconciled_failure'],
  reconciled_success: [],
  reconciled_failure: [],
};

export function canTransitionProviderOperation(
  from: ProviderOperationState,
  to: ProviderOperationState,
): boolean {
  return PROVIDER_TRANSITIONS[from].includes(to);
}

export function transitionProviderOperation(
  from: ProviderOperationState,
  to: ProviderOperationState,
): ProviderOperationState {
  if (!canTransitionProviderOperation(from, to)) {
    throw new Error(`illegal provider operation transition ${from}->${to}`);
  }
  return to;
}

/** Crash after dispatch is recorded as unknown; never a blind second dispatch. */
export function recoverProviderDispatch(state: ProviderOperationState): ProviderOperationState {
  if (state === 'prepared') {
    return 'dispatched';
  }
  if (state === 'dispatched') {
    return transitionProviderOperation(state, 'unknown');
  }
  throw new Error(`illegal provider dispatch recovery from ${state}`);
}

export function nextProviderOrdinal(
  current: number | null,
  reason: 'new_external_call' | 'worker_restart',
): number {
  if (reason === 'worker_restart') {
    if (current === null) {
      throw new Error('worker restart without an existing ordinal');
    }
    return current;
  }
  return (current ?? 0) + 1;
}

export function compareAndSwapVersion(current: number, expected: number): number {
  if (current !== expected) {
    throw new Error('cas collision');
  }
  return current + 1;
}

export const IDEMPOTENCY_STATES = ['started', 'completed'] as const;
export type IdempotencyState = typeof IDEMPOTENCY_STATES[number];

export function replayIdempotency(input: {
  state: IdempotencyState;
  storedHash: string;
  requestHash: string;
}): 'same' | 'conflict' {
  if (input.storedHash !== input.requestHash) {
    return 'conflict';
  }
  return 'same';
}
