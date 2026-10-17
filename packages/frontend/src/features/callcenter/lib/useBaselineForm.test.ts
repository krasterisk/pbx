import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBaselineForm } from './useBaselineForm';

describe('useBaselineForm', () => {
  it('is dirty after an edit, clean after markSaved, and reverts to the baseline', () => {
    const { result } = renderHook(() => useBaselineForm({ a: 1 }));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setForm({ a: 2 }));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.revert());
    expect(result.current.form).toEqual({ a: 1 });
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setForm({ a: 3 }));
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });

  it('does not overwrite unsaved edits with server data, but applies it when clean', () => {
    const { result } = renderHook(() => useBaselineForm({ a: 1 }));
    act(() => result.current.syncFromServer({ a: 5 }));
    expect(result.current.form).toEqual({ a: 5 });
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setForm({ a: 9 }));
    act(() => result.current.syncFromServer({ a: 7 }));
    expect(result.current.form).toEqual({ a: 9 });
  });
});
