import { describe, it, expect, beforeEach } from 'vitest';
import {
  CC_LAST_SHIFT_QUEUES_KEY,
  isQueuesSelectionValid,
  loadLastShiftQueues,
  saveLastShiftQueues,
} from './shiftLoginQueues';

describe('shiftLoginQueues', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects empty queue selection', () => {
    expect(isQueuesSelectionValid([])).toBe(false);
  });

  it('accepts selection with at least one queue', () => {
    expect(isQueuesSelectionValid(['sales'])).toBe(true);
    expect(isQueuesSelectionValid(['sales', 'support'])).toBe(true);
  });

  it('persists and restores last queues filtered to options', () => {
    saveLastShiftQueues(['sales', 'gone']);
    expect(localStorage.getItem(CC_LAST_SHIFT_QUEUES_KEY)).toBe(
      JSON.stringify(['sales', 'gone']),
    );
    expect(loadLastShiftQueues(['sales', 'support'])).toEqual(['sales']);
  });

  it('returns empty on invalid JSON or non-array', () => {
    localStorage.setItem(CC_LAST_SHIFT_QUEUES_KEY, '{not-json');
    expect(loadLastShiftQueues(['sales'])).toEqual([]);
    localStorage.setItem(CC_LAST_SHIFT_QUEUES_KEY, '"sales"');
    expect(loadLastShiftQueues(['sales'])).toEqual([]);
  });
});
