import { classifyProviderError, nextRetryDelayMs, type RetryClass } from './retry-budget';
import type { StageState } from './state-machines';

export type RetryStage = {
  state: StageState;
  attemptCount: number;
  errorCode: string | null;
  nextRunAt: Date | null;
  leaseOwner: string | null;
  leaseUntil: Date | null;
};

export function applyStageRetry(
  stage: RetryStage,
  kind: RetryClass,
  now: Date,
  random?: () => number,
): RetryStage {
  if (classifyProviderError(kind) === 'fail') {
    return {
      ...stage,
      state: 'failed',
      errorCode: 'permanent',
      nextRunAt: null,
      leaseOwner: null,
      leaseUntil: null,
    };
  }
  const delay = nextRetryDelayMs(stage.attemptCount, random);
  if (delay == null) {
    return {
      ...stage,
      state: 'failed',
      errorCode: 'dlq',
      nextRunAt: null,
      leaseOwner: null,
      leaseUntil: null,
    };
  }
  return {
    ...stage,
    state: 'pending',
    attemptCount: stage.attemptCount + 1,
    errorCode: 'transient',
    nextRunAt: new Date(now.getTime() + delay),
    leaseOwner: null,
    leaseUntil: null,
  };
}
