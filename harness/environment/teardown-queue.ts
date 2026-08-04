/** Shared cleanup queue — runner drains this in finally even on scenario failure. */

type CleanupFn = () => Promise<void>;

interface CleanupEntry {
  id: string;
  fn: CleanupFn;
}

const queue: CleanupEntry[] = [];

export function registerCleanup(fn: CleanupFn, id: string): void {
  if (queue.some((entry) => entry.id === id)) return;
  queue.push({ id, fn });
}

export function clearCleanupQueue(): void {
  queue.length = 0;
}

export async function runCleanupQueue(): Promise<void> {
  if (queue.length === 0) return;

  console.log(`→ teardown: running ${queue.length} cleanup handler(s)`);
  const pending = [...queue].reverse();
  clearCleanupQueue();

  for (const { id, fn } of pending) {
    try {
      await fn();
      console.log(`✓ teardown: ${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ teardown failed (${id}): ${message}`);
    }
  }
}
