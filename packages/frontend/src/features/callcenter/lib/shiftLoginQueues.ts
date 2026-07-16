/** localStorage key for last selected shift queues (restore on next open). */
export const CC_LAST_SHIFT_QUEUES_KEY = 'cc:lastShiftQueues';

/** At least one queue is required so AMI QueueAdd runs on agentLogin. */
export function isQueuesSelectionValid(queues: string[]): boolean {
  return queues.length >= 1;
}

/**
 * Restore last queues from localStorage, filtered to current queueOptions.
 * Ignores invalid JSON / non-array values.
 */
export function loadLastShiftQueues(
  queueOptions: string[],
  storage: Pick<Storage, 'getItem'> = localStorage,
): string[] {
  try {
    const raw = storage.getItem(CC_LAST_SHIFT_QUEUES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(queueOptions);
    return parsed.filter((q): q is string => typeof q === 'string' && allowed.has(q));
  } catch {
    return [];
  }
}

/** Persist selected queues after a successful shift start. */
export function saveLastShiftQueues(
  queues: string[],
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(CC_LAST_SHIFT_QUEUES_KEY, JSON.stringify(queues));
}
