export const DEFAULT_RUNNING_CAP = 8;
export const DEFAULT_QUEUE_CAP = 32;

export const ACTIVE_JOB_STATES = [
  'queued', 'running', 'retry_wait', 'awaiting_reconciliation', 'blocked',
] as const;

export type FairnessCaps = {
  runningCap: number;
  queueCap: number;
};

export function assertFairness(
  counts: { running: number; queued: number },
  caps: FairnessCaps = { runningCap: DEFAULT_RUNNING_CAP, queueCap: DEFAULT_QUEUE_CAP },
): void {
  if (counts.running >= caps.runningCap || counts.queued >= caps.queueCap) {
    throw Object.assign(new Error('tenant fairness cap exceeded'), {
      code: 'fairness_exhausted',
      status: 503,
    });
  }
}
