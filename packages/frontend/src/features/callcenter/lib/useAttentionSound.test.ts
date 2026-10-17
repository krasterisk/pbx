import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AttentionItem } from './attentionItems';
import { newCriticalIds, useAttentionSound } from './useAttentionSound';

const item = (id: string, severity: AttentionItem['severity']): AttentionItem => ({
  id,
  kind: 'queue_wait',
  severity,
  overrun: 1,
});

describe('newCriticalIds', () => {
  it('returns only critical ids that were not seen before', () => {
    const fresh = newCriticalIds(new Set(['a']), [item('a', 'critical'), item('b', 'critical'), item('c', 'warning')]);
    expect(fresh).toEqual(['b']);
  });
});

describe('useAttentionSound', () => {
  it('does not beep for the backlog present on the first evaluation', () => {
    const play = vi.fn();
    renderHook(() => useAttentionSound([item('a', 'critical')], true, play));
    expect(play).not.toHaveBeenCalled();
  });

  it('beeps once when a new critical item appears, not for the same item on later ticks', () => {
    const play = vi.fn();
    const { rerender } = renderHook(({ items }) => useAttentionSound(items, true, play), {
      initialProps: { items: [] as AttentionItem[] },
    });

    rerender({ items: [item('a', 'critical')] });
    expect(play).toHaveBeenCalledTimes(1);

    rerender({ items: [item('a', 'critical')] });
    expect(play).toHaveBeenCalledTimes(1);

    rerender({ items: [item('a', 'critical'), item('b', 'critical')] });
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('warnings never beep and a disabled setting stays silent', () => {
    const play = vi.fn();
    const { rerender } = renderHook(({ items, enabled }) => useAttentionSound(items, enabled, play), {
      initialProps: { items: [] as AttentionItem[], enabled: true },
    });
    rerender({ items: [item('w', 'warning')], enabled: true });
    expect(play).not.toHaveBeenCalled();

    rerender({ items: [item('x', 'critical')], enabled: false });
    expect(play).not.toHaveBeenCalled();
  });

  it('a recovered item beeps again when it breaks again', () => {
    const play = vi.fn();
    const { rerender } = renderHook(({ items }) => useAttentionSound(items, true, play), {
      initialProps: { items: [] as AttentionItem[] },
    });
    rerender({ items: [item('a', 'critical')] });
    rerender({ items: [] });
    rerender({ items: [item('a', 'critical')] });
    expect(play).toHaveBeenCalledTimes(2);
  });
});
