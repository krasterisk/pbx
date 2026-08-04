/**
 * API-based teardown — DELETE via public HTTP (D-16). Cleanup queue runs in finally blocks.
 */
import { registerCleanup as registerMohCleanup, runCleanupQueue } from './teardown-queue.js';

export { runCleanupQueue };

const DEFAULT_API_URL = 'http://localhost:5010';

function apiUrl(): string {
  return (process.env.HARNESS_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
}

export async function deleteMohByName(token: string, name: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/api/moh/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MOH delete failed (${res.status}): ${body}`);
  }
}

/** Register MOH name for cleanup; processed by runCleanupQueue in runner finally. */
export function registerCleanup(name: string, token?: string): void {
  registerMohCleanup(async () => {
    const bearer = token ?? process.env.HARNESS_CLEANUP_TOKEN;
    if (!bearer) {
      console.warn(`teardown: skipping MOH ${name} — no token`);
      return;
    }
    await deleteMohByName(bearer, name);
  }, `moh:${name}`);
}
