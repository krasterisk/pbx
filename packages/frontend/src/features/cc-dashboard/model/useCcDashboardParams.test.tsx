import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCcDashboardParams } from './useCcDashboardParams';

const wrapperAt = (url: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  };

function render(url: string) {
  return renderHook(
    () => ({ dash: useCcDashboardParams(), location: useLocation() }),
    { wrapper: wrapperAt(url) },
  );
}

describe('useCcDashboardParams', () => {
  it('defaults to today, comparison on, all queues, and keeps the URL clean', () => {
    const { result } = render('/callcenter/dashboard');
    expect(result.current.dash.params).toEqual({ period: 'today', from: undefined, to: undefined, compare: true, queues: [] });
    expect(result.current.dash.ready).toBe(true);
    expect(result.current.location.search).toBe('');
  });

  it('reads the state from a shared link and ignores garbage', () => {
    const { result } = render('/x?period=custom&from=2026-07-01&to=2026-07-03&compare=0&queues=sales,%20support,sales');
    expect(result.current.dash.params).toEqual({
      period: 'custom', from: '2026-07-01', to: '2026-07-03', compare: false, queues: ['sales', 'support'],
    });
    const bad = render('/x?period=decade&from=yesterday');
    expect(bad.result.current.dash.params).toMatchObject({ period: 'today', from: undefined });
  });

  it('a custom period is not ready until both dates are valid and ordered', () => {
    expect(render('/x?period=custom').result.current.dash.ready).toBe(false);
    expect(render('/x?period=custom&from=2026-07-01').result.current.dash.ready).toBe(false);
    expect(render('/x?period=custom&from=2026-07-05&to=2026-07-01').result.current.dash.ready).toBe(false);
    expect(render('/x?period=custom&from=2026-07-01&to=2026-07-05').result.current.dash.ready).toBe(true);
  });

  it('writes presets, drops the custom range when leaving custom, and removes defaults from the URL', () => {
    const { result } = render('/x');
    act(() => result.current.dash.setPeriod('7d'));
    expect(result.current.location.search).toBe('?period=7d');

    act(() => result.current.dash.setRange('2026-07-01', '2026-07-03'));
    expect(new URLSearchParams(result.current.location.search).get('from')).toBe('2026-07-01');

    act(() => result.current.dash.setPeriod('yesterday'));
    expect(result.current.location.search).toBe('?period=yesterday');

    act(() => result.current.dash.setPeriod('today'));
    expect(result.current.location.search).toBe('');
  });

  it('stores compare off as 0 and queues as a comma list, both reversible', () => {
    const { result } = render('/x');
    act(() => result.current.dash.setCompare(false));
    act(() => result.current.dash.setQueues(['sales', 'support']));
    expect(new URLSearchParams(result.current.location.search).get('compare')).toBe('0');
    expect(result.current.dash.params).toMatchObject({ compare: false, queues: ['sales', 'support'] });

    act(() => result.current.dash.setCompare(true));
    act(() => result.current.dash.setQueues([]));
    expect(result.current.location.search).toBe('');
  });
});
