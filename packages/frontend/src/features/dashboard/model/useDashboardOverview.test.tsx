import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDashboardOverview } from './useDashboardOverview';
const mocks = vi.hoisted(() => ({ refetch:vi.fn(), disconnect:vi.fn(), on:vi.fn(), query:vi.fn(), socket:vi.fn() }));
vi.mock('@/shared/api/endpoints/dashboardApi', () => ({ useGetDashboardOverviewQuery: (params:unknown, options:unknown) => { mocks.query(params,options); return { refetch:mocks.refetch }; } }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (select:(state:unknown)=>unknown) => select({ auth:{ accessToken:'token' } }) }));
vi.mock('@/shared/api/apiBase', () => ({ getAuthApiBase: () => '/api' }));
vi.mock('socket.io-client', () => ({ io: (...args:unknown[]) => { mocks.socket(...args); return { on:mocks.on,disconnect:mocks.disconnect }; } }));
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); Object.defineProperty(document,'visibilityState',{ configurable:true,value:'visible' }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('bounded dashboard refresh', () => {
  it('coalesces notification bursts and pauses HTTP/socket while hidden', () => {
    renderHook(() => useDashboardOverview({ period:'today' }));
    expect(mocks.socket).toHaveBeenCalledWith(expect.stringContaining('/pbx-dashboard'),expect.objectContaining({ auth:{ token:'token' } }));
    const notify = mocks.on.mock.calls[0][1] as (event:{ version:string })=>void;
    act(() => { for(let i=0;i<1000;i+=1)notify({ version:String(i) }); vi.advanceTimersByTime(4999); });
    expect(mocks.refetch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    act(() => { Object.defineProperty(document,'visibilityState',{ configurable:true,value:'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(30000));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    act(() => { Object.defineProperty(document,'visibilityState',{ configurable:true,value:'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
    expect(mocks.socket).toHaveBeenCalledTimes(2);
  });
});
