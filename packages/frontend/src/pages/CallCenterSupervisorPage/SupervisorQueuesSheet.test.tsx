import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import callCenter, { setSnapshot } from '@/features/callcenter/model/slice/callCenterSlice';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import { SupervisorQueuesSheet } from './SupervisorQueuesSheet';

const api = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn(), reconcile: vi.fn(), refetch: vi.fn() }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useSupervisorQueueAddMutation: () => [api.add],
  useSupervisorQueueRemoveMutation: () => [api.remove],
  useSupervisorReconcileQueuesMutation: () => [api.reconcile],
}));
vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [
    { name: 'sales', display_name: 'Sales', exten: '700' },
    { name: 'support', display_name: 'Support', exten: '701' },
  ], isLoading: false, isError: false, refetch: api.refetch }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const agent: IAgent = { interface: 'PJSIP/201', name: 'Synthetic operator', userId: 1, userUid: 8,
  status: 'READY', queues: ['sales'], callsTaken: 4 };

function mount(allowed: string[] | null = null, row = agent) {
  const store = configureStore({ reducer: { callCenter } });
  store.dispatch(setSnapshot({ agents: [row], queues: [], calls: [] }));
  render(<Provider store={store}><SupervisorQueuesSheet agent={row} open onClose={vi.fn()} allowedQueues={allowed} /></Provider>);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.reconcile.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, queues: ['sales'] }) });
  api.add.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, queues: ['sales', 'support'] }) });
  api.remove.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, queues: [] }) });
});

describe('supervisor queue membership Sheet', () => {
  it('changes the SSE store optimistically, serializes pending edits, then restores failures', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise((_resolve, fail) => { reject = fail; });
    api.add.mockReturnValue({ unwrap: () => pending });
    const store = mount();
    const support = await screen.findByRole('switch', { name: /^Support/ });
    await waitFor(() => expect(support).toBeEnabled());
    fireEvent.click(support);
    expect(store.getState().callCenter.agents[0].queues).toEqual(['sales', 'support']);
    expect(support).toBeChecked();
    expect(support).toBeDisabled();
    fireEvent.click(support);
    expect(api.add).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error('synthetic server rejection')); });
    await waitFor(() => expect(support).not.toBeChecked());
    expect(store.getState().callCenter.agents[0].queues).toEqual(['sales']);
    expect(screen.getByRole('alert')).toHaveTextContent('membershipWriteError');
  });

  it('uses returned membership and handles removing the last queue', async () => {
    const store = mount();
    const sales = await screen.findByRole('switch', { name: /^Sales/ });
    await waitFor(() => expect(sales).toBeEnabled());
    fireEvent.click(sales);
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith({ agentInterface: agent.interface, queue: 'sales' }));
    await waitFor(() => expect(sales).toBeEnabled());
    expect(store.getState().callCenter.agents[0].queues).toEqual([]);
    expect(sales).not.toBeChecked();
  });

  it('honors a restricted scope including the empty list', async () => {
    mount(['700']);
    await waitFor(() => expect(screen.getByRole('switch', { name: /^Sales/ })).toBeEnabled());
    expect(screen.queryByRole('switch', { name: /^Support/ })).not.toBeInTheDocument();
  });

  it('does not grant queue access for an empty scope', async () => {
    mount([]);
    await screen.findByText('callcenter.supervisor.pulse.noAllowedQueues');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(api.add).not.toHaveBeenCalled();
  });

  it('does not operate a placeholder or an operator outside a shift', () => {
    mount(null, { ...agent, interface: 'user:1', status: 'OFFLINE', queues: [] });
    expect(screen.getByRole('switch', { name: /^Sales/ })).toBeDisabled();
    expect(api.reconcile).not.toHaveBeenCalled();
  });

  it('requires a successful membership reconciliation before enabling writes', async () => {
    api.reconcile.mockReturnValue({ unwrap: () => Promise.reject(new Error('synthetic resync failure')) });
    mount();
    await screen.findByRole('alert');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(api.add).not.toHaveBeenCalled();
  });
});
