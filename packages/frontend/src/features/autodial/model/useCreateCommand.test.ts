import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateCommand } from './useCreateCommand';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), check: vi.fn(), reset: vi.fn(), user: { uniqueid: 4, vpbx_user_uid: 71 } }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: mocks.user } }),
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({ autodialApi: { util: { invalidateTags: (tags: unknown) => ({ invalidate: tags }) }, endpoints: {
  checkAutodialUiCommand: { initiate: (id: string) => ({ command: id }) },
} } }));
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks();
  mocks.dispatch.mockImplementation(() => ({ unwrap: mocks.check, reset: mocks.reset }));
});
const mount = () => renderHook(() => useCreateCommand<{ name: string }, { name: string }>('base'));
const key = 'autodial:create:71:4:base:create';

describe('uncertain browser saves', () => {
  it('restores the original payload and command after reload and uses that identity on retry', async () => {
    const first = mount(), send = vi.fn().mockRejectedValue({ status: 504 });
    await act(async () => { await expect(first.result.current.run({ name: 'Draft' }, { name: 'Original' }, send)).rejects.toEqual({ status: 504 }); });
    const id = first.result.current.pending!.id;
    expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject({ id, payload: { name: 'Original' } });
    first.unmount();
    const second = mount();
    expect(second.result.current.pending?.draft).toEqual({ name: 'Draft' });
    const retry = vi.fn().mockResolvedValue({ uid: 8 });
    await act(async () => { await second.result.current.run({ name: 'Changed draft' }, { name: 'Changed payload' }, retry); });
    expect(retry).toHaveBeenCalledWith({ name: 'Original' }, id);
    expect(second.result.current.pending).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it('clears a definitive validation failure so a corrected form gets a new identity', async () => {
    const hook = mount(), send = vi.fn().mockRejectedValueOnce({ status: 400 }).mockResolvedValueOnce({ uid: 8 });
    await act(async () => { await expect(hook.result.current.run({ name: '' }, { name: '' }, send)).rejects.toEqual({ status: 400 }); });
    expect(hook.result.current.pending).toBeNull();
    await act(async () => { await hook.result.current.run({ name: 'Fixed' }, { name: 'Fixed' }, send); });
    expect(send.mock.calls[0][1]).not.toBe(send.mock.calls[1][1]);
  });
  it('keeps an unknown result pending and reconciles a completed one without resubmitting the create', async () => {
    const hook = mount(), send = vi.fn().mockRejectedValue({ status: 'TIMEOUT_ERROR' });
    await act(async () => { await expect(hook.result.current.run({ name: 'A' }, { name: 'A' }, send)).rejects.toBeDefined(); });
    const id = hook.result.current.pending!.id;
    mocks.check.mockResolvedValueOnce({ status: 'unknown' }).mockResolvedValueOnce({ status: 'completed', operation: 'create_base', resource_uid: 8 });
    await act(async () => { expect(await hook.result.current.check()).toBeNull(); });
    expect(hook.result.current.pending?.id).toBe(id);
    await act(async () => { expect(await hook.result.current.check()).toBe(8); });
    expect(hook.result.current.pending).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenLastCalledWith({ invalidate: [
      { type: 'AutodialBases', id: 'LIST' }, { type: 'AutodialBases', id: 8 },
    ] });
    expect(mocks.reset).toHaveBeenCalledTimes(2);
  });
});
