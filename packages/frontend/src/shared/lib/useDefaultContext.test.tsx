import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useDefaultContext } from './useDefaultContext';
import type { IContext } from '@/shared/api/endpoints/contextApi';

const rows = [{ uid: 1, name: 'internal', is_default_for_endpoints: true }, { uid: 2, name: 'carrier', is_default_for_trunks: true }] as IContext[];
describe('useDefaultContext', () => {
  function useDraft(props: { open: boolean; create: boolean; rows: IContext[] }) {
    const [value, setValue] = useState('preserved');
    const choose = useDefaultContext(props.open, props.create, props.rows, 'endpoints', setValue);
    return { value, choose };
  }
  it('applies late defaults but preserves a user selection across refetch', () => {
    const { result, rerender } = renderHook(useDraft, { initialProps: { open: true, create: true, rows: [] as IContext[] } });
    expect(result.current.value).toBe('');
    rerender({ open: true, create: true, rows });
    expect(result.current.value).toBe('internal');
    act(() => result.current.choose('carrier'));
    rerender({ open: true, create: true, rows: [...rows] });
    expect(result.current.value).toBe('carrier');
    rerender({ open: false, create: true, rows });
    rerender({ open: true, create: true, rows });
    expect(result.current.value).toBe('internal');
  });
  it('preserves edits and copies', () => {
    const { result } = renderHook(useDraft, { initialProps: { open: true, create: false, rows } });
    expect(result.current.value).toBe('preserved');
  });
});
