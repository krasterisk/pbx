export const AI_RETRY_MAX_ATTEMPTS = 3;
export const AI_RETRY_CEILING_MS = 5 * 60 * 1000;

export type RetryClass = 'transient' | 'protocol' | 'permanent';

export function classifyProviderError(kind: RetryClass): 'retry' | 'fail' {
  return kind === 'transient' ? 'retry' : 'fail';
}

export function nextRetryDelayMs(attempt: number, random: () => number = Math.random): number | null {
  if (attempt >= AI_RETRY_MAX_ATTEMPTS) return null;
  const exp = Math.min(1000 * (2 ** attempt), AI_RETRY_CEILING_MS);
  const jitter = Math.floor(random() * 250);
  return Math.min(exp + jitter, AI_RETRY_CEILING_MS);
}

export function nextRetryAt(attempt: number, now: Date, random?: () => number): Date | null {
  const delay = nextRetryDelayMs(attempt, random);
  return delay == null ? null : new Date(now.getTime() + delay);
}
