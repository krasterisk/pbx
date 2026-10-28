import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useVisibleTick } from './useVisibleTick';

let instances: TestObserver[];
class TestObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(private callback: IntersectionObserverCallback) { instances.push(this); }
  report(targets: Element[], visible: boolean) {
    this.callback(targets.map(target => ({ target, isIntersecting: visible })) as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}
function Clock({ name }: { name: string }) {
  const { ref, now } = useVisibleTick(true);
  return <span ref={ref} data-testid={name}>{now}</span>;
}

describe('viewport clock budget', () => {
  beforeEach(() => {
    instances = [];
    vi.useFakeTimers({ now: 1000 });
    vi.stubGlobal('IntersectionObserver', TestObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('does not tick offscreen, then catches up immediately when revealed', () => {
    const view = render(<Clock name="clock" />);
    const cell = screen.getByTestId('clock');
    act(() => vi.advanceTimersByTime(2000));
    expect(cell.textContent).toBe('1000');
    expect(vi.getTimerCount()).toBe(0);
    act(() => instances[0].report([cell], true));
    expect(cell.textContent).toBe('3000');
    act(() => vi.advanceTimersByTime(1000));
    expect(cell.textContent).toBe('4000');
    act(() => instances[0].report([cell], false));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(cell.textContent).toBe('4000');
    act(() => instances[0].report([cell], true));
    expect(cell.textContent).toBe('6000');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(instances[0].disconnect).toHaveBeenCalledOnce();
  });

  it('shares one observer and one timer across visible cells and releases both', () => {
    const view = render(<><Clock name="first" /><Clock name="second" /></>);
    expect(instances).toHaveLength(1);
    act(() => instances[0].report([screen.getByTestId('first'), screen.getByTestId('second')], true));
    expect(vi.getTimerCount()).toBe(1);
    act(() => instances[0].report([screen.getByTestId('first')], false));
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(instances[0].unobserve).toHaveBeenCalledTimes(2);
    expect(instances[0].disconnect).toHaveBeenCalledOnce();
  });
});
