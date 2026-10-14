import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { useTrunkRegistration } from './useTrunkRegistration';

const mocks = vi.hoisted(() => ({ register: vi.fn(), bulk: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => options ? `${key}:${options.count}` : key }) }));
vi.mock('react-toastify', () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }));
vi.mock('@/shared/api/endpoints/trunkApi', () => ({ useRegisterTrunkMutation: () => [mocks.register], useBulkRegisterTrunksMutation: () => [mocks.bulk] }));

describe('bounded registration requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bulk.mockImplementation((ids: string[]) => ({ unwrap: () => Promise.resolve({ results: ids.map((id) => ({ id, status: 'requested' })) }) }));
  });

  it('chunks selections above the API limit and deduplicates IDs', async () => {
    const selected = Array.from({ length: 205 }, (_, index) => ({ id: `trunk-${index}`, trunkType: 'auth' }) as ITrunkListItem);
    const { result } = renderHook(() => useTrunkRegistration());
    await act(async () => result.current.requestSelectedRegistration([...selected, selected[0]]));
    expect(mocks.bulk.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 5]);
    expect(mocks.success).toHaveBeenCalledWith('trunks.registrationRequestedCount:205');
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('does not issue a bulk request for IP-only targets', async () => {
    const { result } = renderHook(() => useTrunkRegistration());
    await act(async () => result.current.requestSelectedRegistration([{ id: 'ip', trunkType: 'ip' } as ITrunkListItem]));
    expect(mocks.bulk).not.toHaveBeenCalled();
  });

  it('locks each pending target without blocking another trunk', async () => {
    const resolvers = new Map<string, () => void>();
    mocks.register.mockImplementation((id: string) => ({ unwrap: () => new Promise<void>((resolve) => resolvers.set(id, resolve)) }));
    const first = { id: 'first', trunkType: 'auth' } as ITrunkListItem;
    const second = { id: 'second', trunkType: 'auth' } as ITrunkListItem;
    const { result } = renderHook(() => useTrunkRegistration());
    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.requestRegistration(first);
      void result.current.requestRegistration(first);
      secondRequest = result.current.requestRegistration(second);
    });
    expect(mocks.register.mock.calls.map(([id]) => id)).toEqual(['first', 'second']);
    expect([...result.current.pendingIds]).toEqual(['first', 'second']);
    await act(async () => {
      resolvers.get('first')?.();
      await firstRequest;
    });
    expect([...result.current.pendingIds]).toEqual(['second']);
    await act(async () => {
      resolvers.get('second')?.();
      await secondRequest;
    });
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('continues bounded batches after a request failure and reports the failed targets', async () => {
    mocks.bulk.mockImplementationOnce(() => ({ unwrap: () => Promise.reject(new Error('unavailable')) }));
    const selected = Array.from({ length: 101 }, (_, index) => ({ id: `trunk-${index}`, trunkType: 'auth' }) as ITrunkListItem);
    const { result } = renderHook(() => useTrunkRegistration());
    await act(async () => result.current.requestSelectedRegistration(selected));
    expect(mocks.bulk).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledWith('trunks.registrationFailedCount:100');
    expect(mocks.success).toHaveBeenCalledWith('trunks.registrationRequestedCount:1');
  });
});
