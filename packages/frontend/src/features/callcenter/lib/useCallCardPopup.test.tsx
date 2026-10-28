import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  agent: { interface: 'PJSIP/e203_0', currentCall: 'call.1', status: 'IN_CALL' } as any,
  calls: [{ uniqueid: 'call.1', queue: 'q701_0', callerIdNum: '202', status: 'TALKING' }] as any[],
  templates: [{ uid: 1, name: 'Card', is_active: true, auto_open_on: 'answer', queue_names: [], fields: [{ field_key: 'name', field_type: 'text', label: 'Name', default_value: 'Default' }] }] as any[],
  load: vi.fn(), lookup: vi.fn(), error: vi.fn(),
}));
vi.mock('react-redux', () => ({ useSelector: (selector: () => unknown) => selector() }));
vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({ selectMyAgent: () => state.agent, selectCcCalls: () => state.calls }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({ useGetCardTemplatesQuery: () => ({ data: state.templates }), useLazyClientLookupQuery: () => [state.lookup], useLazyGetCardByCallQuery: () => [state.load] }));
vi.mock('react-toastify', () => ({ toast: { error: state.error } }));
import { useCallCardPopup, resolveTemplate } from './useCallCardPopup';

beforeEach(() => {
  vi.clearAllMocks(); state.agent = { interface: 'PJSIP/e203_0', currentCall: 'call.1', status: 'IN_CALL' };
  state.calls = [{ uniqueid: 'call.1', queue: 'q701_0', callerIdNum: '202', status: 'TALKING' }];
  state.load.mockImplementation(() => ({ unwrap: () => Promise.resolve({ template_id: 1, field_values: { name: 'Saved' } }) }));
});
describe('call card lifecycle', () => {
  it('uses the originating queue for an answered callback and waits for the configured trigger', async () => {
    const original = state.templates;
    state.templates = [{ ...original[0], uid: 2, queue_names: ['support'], auto_open_on: 'answer' }];
    state.agent = { interface: 'PJSIP/e203_0', directCallUniqueid: 'callback.real', dialTarget: '+7 (900) 123-45-67', status: 'DIALING' };
    const view = renderHook(() => useCallCardPopup({ outboundContext: { target: '79001234567', queue: 'support' } }));
    expect(view.result.current.open).toBe(false);
    state.agent = { ...state.agent, status: 'IN_CALL' }; view.rerender();
    await waitFor(() => expect(view.result.current.open).toBe(true));
    expect(view.result.current.callContext).toEqual({ uniqueid: 'callback.real', callerId: '+7 (900) 123-45-67', queue: 'support' });
    expect(view.result.current.template?.uid).toBe(2);
    state.agent = { ...state.agent, status: 'READY', currentCall: 'call.1' }; view.rerender();
    expect(view.result.current.open).toBe(false);
    state.templates = original;
  });
  it('does not borrow a callback queue for another target or bypass a manual template', async () => {
    const original = state.templates;
    state.templates = [{ ...original[0], queue_names: ['support'], auto_open_on: 'manual' }];
    state.agent = { interface: 'PJSIP/e203_0', directCallUniqueid: 'direct.real', dialTarget: '201', status: 'IN_CALL' };
    const view = renderHook(() => useCallCardPopup({ outboundContext: { target: '1201', queue: 'support' } }));
    expect(view.result.current.availableTemplate).toBeNull();
    expect(view.result.current.open).toBe(false);
    state.agent = { ...state.agent, dialTarget: '1201' }; view.rerender();
    expect(view.result.current.availableTemplate?.uid).toBe(1);
    expect(view.result.current.open).toBe(false);
    state.templates = original;
  });
  it('keeps the same card through callEnd then WRAPUP and closes only on READY', async () => {
    const { result, rerender } = renderHook(() => useCallCardPopup());
    await waitFor(() => expect(result.current.open).toBe(true));
    state.calls = []; rerender();
    expect(result.current.open).toBe(true);
    state.agent = { ...state.agent, status: 'WRAPUP', currentCall: undefined }; rerender();
    expect(result.current.callContext?.uniqueid).toBe('call.1');
    expect(result.current.open).toBe(true);
    state.agent = { ...state.agent, status: 'READY' }; rerender();
    expect(result.current.open).toBe(false);
  });
  it('opens a global template for an answered non-queue call with its real journal identity', async () => {
    state.agent = { interface: 'PJSIP/e203_0', directCallUniqueid: 'direct.1', dialTarget: '202', status: 'IN_CALL', userUid: 7 };
    const { result } = renderHook(() => useCallCardPopup());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(result.current.callContext).toEqual({ uniqueid: 'direct.1', callerId: '202', queue: '' });
  });
  it('prefers a queue-specific template, then falls back to a template for all queues', () => {
    const specific = { ...state.templates[0], uid: 2, queue_names: ['q701_0'] };
    expect(resolveTemplate([...state.templates, specific], 'q701_0')?.uid).toBe(2);
    expect(resolveTemplate([...state.templates, specific], 'q700_0')?.uid).toBe(1);
  });
  it('opens on answer with saved values; closing survives SSE changes and manual reopening reloads', async () => {
    const { result, rerender } = renderHook(() => useCallCardPopup());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(result.current.initialValues.name).toBe('Saved');
    act(() => result.current.close());
    state.agent = { ...state.agent }; rerender();
    expect(result.current.open).toBe(false); expect(state.load).toHaveBeenCalledTimes(1);
    act(() => result.current.openManually());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(state.load).toHaveBeenCalledTimes(2);
  });
  it('treats 404 as a new card, but never offers a blank overwrite after a server/access error', async () => {
    state.load.mockImplementation(() => ({ unwrap: () => Promise.reject({ status: 404 }) }));
    const first = renderHook(() => useCallCardPopup());
    await waitFor(() => expect(first.result.current.open).toBe(true));
    expect(first.result.current.initialValues.name).toBe('Default'); first.unmount();
    state.load.mockImplementation(() => ({ unwrap: () => Promise.reject({ status: 403 }) }));
    const second = renderHook(() => useCallCardPopup());
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(second.result.current.open).toBe(false);
  });
  it('does not reopen a late response after logout', async () => {
    let resolve!: (value: unknown) => void;
    state.load.mockImplementation(() => ({ unwrap: () => new Promise(r => { resolve = r; }) }));
    const { result, rerender } = renderHook(() => useCallCardPopup());
    state.agent = null; rerender();
    await act(async () => resolve({ template_id: 1, field_values: { name: 'Late' } }));
    expect(result.current.open).toBe(false);
  });
});
