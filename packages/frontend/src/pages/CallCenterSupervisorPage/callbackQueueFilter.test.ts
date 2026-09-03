import { describe, it, expect } from 'vitest';
import { filterCallbackRowsByQueue } from './callbackQueueFilter';

describe('filterCallbackRowsByQueue (D-50)', () => {
  const rows = [
    { id: 1, queue_label: 'sales' },
    { id: 2, queue_label: 'qsupport_12' },
    { id: 3, queue_label: null },
  ];

  it('returns all rows when the existing page filter is empty', () => {
    expect(filterCallbackRowsByQueue(rows, [])).toEqual(rows);
  });

  it('keeps matching queue_label and prefixed qNAME_uid, drops route-only', () => {
    expect(filterCallbackRowsByQueue(rows, ['sales']).map((r) => r.id)).toEqual([1]);
    expect(filterCallbackRowsByQueue(rows, ['support']).map((r) => r.id)).toEqual([2]);
    expect(filterCallbackRowsByQueue(rows, ['qsupport_12']).map((r) => r.id)).toEqual([2]);
  });
});
