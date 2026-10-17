import type { IAgent } from '../model/types/callCenterSchema';

export interface WatchlistCandidate {
  userId: number;
  name: string;
  exten: string;
  online?: boolean;
}

export interface WatchlistGroup {
  /** `queue:<name>` or `queue:__none__`. */
  id: string;
  label: string;
  candidates: WatchlistCandidate[];
}

export const WATCHLIST_NO_QUEUE_ID = 'queue:__none__';

function matches(c: WatchlistCandidate, needle: string): boolean {
  if (!needle) return true;
  return `${c.name} ${c.exten}`.toLowerCase().includes(needle);
}

/**
 * Groups operators the supervisor may watch by queue (U1.7).
 * Queue membership comes from live agents (SSE); candidates with no live record land in "no queue".
 * An operator in several queues is listed in each of them.
 */
export function groupWatchlistCandidates(
  candidates: readonly WatchlistCandidate[],
  agents: readonly Pick<IAgent, 'userId' | 'queues'>[],
  queueLabel: (queueName: string) => string,
  noQueueLabel: string,
  search = '',
): WatchlistGroup[] {
  const needle = search.trim().toLowerCase();
  const queuesByUser = new Map<number, string[]>();
  for (const a of agents) {
    if (a.userId > 0 && a.queues?.length) {
      queuesByUser.set(a.userId, [...new Set([...(queuesByUser.get(a.userId) ?? []), ...a.queues])]);
    }
  }

  const byQueue = new Map<string, WatchlistCandidate[]>();
  const unassigned: WatchlistCandidate[] = [];
  for (const c of candidates) {
    if (!matches(c, needle)) continue;
    const queues = queuesByUser.get(c.userId);
    if (!queues || queues.length === 0) {
      unassigned.push(c);
      continue;
    }
    for (const q of queues) {
      const list = byQueue.get(q) ?? [];
      list.push(c);
      byQueue.set(q, list);
    }
  }

  const groups: WatchlistGroup[] = [...byQueue.entries()]
    .map(([q, list]) => ({ id: `queue:${q}`, label: queueLabel(q), candidates: list }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  if (unassigned.length > 0) {
    groups.push({ id: WATCHLIST_NO_QUEUE_ID, label: noQueueLabel, candidates: unassigned });
  }
  return groups;
}

/** Toggle a whole group: if every member is selected clear them, otherwise select all of them. */
export function toggleGroupSelection(
  selected: readonly number[],
  groupUserIds: readonly number[],
): number[] {
  const set = new Set(selected);
  const allSelected = groupUserIds.length > 0 && groupUserIds.every((id) => set.has(id));
  if (allSelected) {
    for (const id of groupUserIds) set.delete(id);
  } else {
    for (const id of groupUserIds) set.add(id);
  }
  return [...set];
}

/** Queue tokens (extension-like) of the queues that the watched agents belong to — "My queues". */
export function myQueueNames(agents: readonly Pick<IAgent, 'queues'>[]): string[] {
  return [...new Set(agents.flatMap((a) => a.queues ?? []))];
}
