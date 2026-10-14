import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCrossPageRowSelection } from './useCrossPageRowSelection';

describe('useCrossPageRowSelection without a desktop table', () => {
  it('clears mobile card selection and the all-matching flag', () => {
    const { result } = renderHook(() => useCrossPageRowSelection({ globalFilter: '' }));
    act(() => result.current.cardSelection('first').onCheckedChange(true));
    act(() => result.current.cardSelection('second').onCheckedChange(true));
    expect(result.current.selectedIds).toEqual(['first', 'second']);
    expect(result.current.tableRef.current).toBeNull();
    act(() => result.current.selectAllMatching(['first', 'second', 'third']));
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.allMatchingSelected).toBe(true);
    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.cardSelection('first').checked).toBe(false);
    expect(result.current.cardSelection('second').checked).toBe(false);
    expect(result.current.allMatchingSelected).toBe(false);
  });
  it('does not enter all-mode when neither a row model nor IDs are available', () => {
    const { result } = renderHook(() => useCrossPageRowSelection({ globalFilter: '' }));
    act(() => result.current.selectAllMatching());
    expect(result.current.allMatchingSelected).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });
});
