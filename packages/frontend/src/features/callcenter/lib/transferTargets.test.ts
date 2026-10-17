import { beforeEach, describe, expect, it } from 'vitest';
import {
  filterTransferTargets,
  loadRecentTransferTargets,
  looksDialable,
  pushRecentTransferTarget,
  resolveEnterTarget,
} from './transferTargets';

const targets = [
  { value: '101', label: 'Anna Petrova' },
  { value: '102', label: 'Boris Ivanov' },
];

describe('transferTargets (U2.5)', () => {
  beforeEach(() => localStorage.clear());

  it('filters by label or number, case-insensitively', () => {
    expect(filterTransferTargets(targets, 'anna').map((t) => t.value)).toEqual(['101']);
    expect(filterTransferTargets(targets, '102').map((t) => t.value)).toEqual(['102']);
    expect(filterTransferTargets(targets, '  ')).toHaveLength(2);
  });

  it('Enter picks the first match, else a typed number, else nothing', () => {
    expect(resolveEnterTarget('an', [targets[0]])).toBe('101');
    expect(resolveEnterTarget('+380441234567', [])).toBe('+380441234567');
    expect(resolveEnterTarget('nobody', [])).toBeNull();
  });

  it('recognises dialable input', () => {
    expect(looksDialable('101')).toBe(true);
    expect(looksDialable('*97')).toBe(true);
    expect(looksDialable('anna')).toBe(false);
  });

  it('keeps the 5 most recent targets, most recent first and without duplicates', () => {
    for (const n of ['1', '2', '3', '4', '5', '6']) pushRecentTransferTarget({ value: n, label: `T${n}` });
    pushRecentTransferTarget({ value: '3', label: 'T3' });
    const recents = loadRecentTransferTargets();
    expect(recents.map((r) => r.value)).toEqual(['3', '6', '5', '4', '2']);
  });
});
