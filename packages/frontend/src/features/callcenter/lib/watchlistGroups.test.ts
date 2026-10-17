import { describe, expect, it } from 'vitest';
import {
  groupWatchlistCandidates,
  myQueueNames,
  toggleGroupSelection,
  WATCHLIST_NO_QUEUE_ID,
} from './watchlistGroups';

const candidates = [
  { userId: 1, name: 'Иванов', exten: '101' },
  { userId: 2, name: 'Петров', exten: '102' },
  { userId: 3, name: 'Сидоров', exten: '103' },
];
const agents = [
  { userId: 1, queues: ['q700_0', 'q800_0'] },
  { userId: 2, queues: ['q700_0'] },
];
const label = (q: string) => `Очередь ${q}`;

describe('groupWatchlistCandidates (U1.7)', () => {
  it('groups by queue, lists multi-queue operators in each, and keeps the rest in "no queue"', () => {
    const groups = groupWatchlistCandidates(candidates, agents, label, 'Вне очередей');
    expect(groups.map((g) => g.id)).toEqual(['queue:q700_0', 'queue:q800_0', WATCHLIST_NO_QUEUE_ID]);
    expect(groups[0].candidates.map((c) => c.userId)).toEqual([1, 2]);
    expect(groups[1].candidates.map((c) => c.userId)).toEqual([1]);
    expect(groups[2].candidates.map((c) => c.userId)).toEqual([3]);
  });

  it('filters by name or extension and drops empty groups', () => {
    const groups = groupWatchlistCandidates(candidates, agents, label, 'x', '103');
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(WATCHLIST_NO_QUEUE_ID);
    expect(groupWatchlistCandidates(candidates, agents, label, 'x', 'nobody')).toEqual([]);
  });
});

describe('toggleGroupSelection', () => {
  it('selects everyone when not all are selected, clears when all are', () => {
    expect(toggleGroupSelection([5], [1, 2]).sort()).toEqual([1, 2, 5]);
    expect(toggleGroupSelection([1, 2, 5], [1, 2])).toEqual([5]);
  });
});

describe('myQueueNames', () => {
  it('returns unique queue names of the given agents', () => {
    expect(myQueueNames(agents).sort()).toEqual(['q700_0', 'q800_0']);
  });
});
