import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
const data = vi.hoisted(() => ({
  agent: { status: 'READY', phoneOnline: true, queues: ['q701_0'], pickupFailed: false },
  pick: vi.fn(), unwrap: vi.fn(),
}));
vi.mock('react-redux', () => ({ useSelector: (selector: () => unknown) => selector() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetMyOperatorSettingsQuery: () => ({ data: { pickup_enabled: true } }),
  useAgentPickCallMutation: () => [data.pick],
}));
vi.mock('@/features/callcenter/model/selectors/callCenterSelectors', () => ({
  selectMyAgent: () => data.agent, selectCcAgents: () => [], selectCcQueues: () => [],
  selectQueueMonitorCalls: () => [{ uniqueid: 'call', queue: 'q701_0', status: 'WAITING', enterTime: new Date(), callerIdNum: '204' }],
}));
import { WaitingTab } from './WaitingTab';
beforeEach(() => {
  data.agent = { status: 'READY', phoneOnline: true, queues: ['q701_0'], pickupFailed: false };
  data.pick.mockReset().mockImplementation(() => ({ unwrap: data.unwrap }));
  data.unwrap.mockReset().mockResolvedValue({ success: true });
});
describe('queue pickup', () => {
  it('filters current calls without hiding the queue summary or breaking pickup', () => {
    render(<WaitingTab />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-such-caller' } });
    expect(screen.getAllByRole('row')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('No results found');
    expect(screen.queryByRole('button', { name: 'Pick' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '204' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Pick' })).toBeEnabled();
  });
  it('disables repeat actions until the server responds', async () => {
    let finish!: () => void;
    data.unwrap.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<WaitingTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Taking call…' }));
    expect(data.pick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Taking call…' })).toBeDisabled();
    await act(async () => finish());
  });
  it('shows a stale-call error and permits retry rather than hiding the failure in console', async () => {
    data.unwrap.mockRejectedValueOnce({ status: 409 });
    render(<WaitingTab />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pick' })));
    expect(screen.getByRole('alert')).toHaveTextContent('already been taken');
    expect(screen.getByRole('button', { name: 'Pick' })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pick' })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not offer pickup while the phone is unavailable', () => {
    data.agent.phoneOnline = false;
    render(<WaitingTab />);
    expect(screen.getByRole('button', { name: 'Pick' })).toBeDisabled();
  });
  it('keeps an asynchronous no-answer error visible after the waiting panel remounts', () => {
    data.agent.pickupFailed = true;
    render(<WaitingTab />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your phone did not answer');
    expect(screen.getByRole('button', { name: 'Pick' })).toBeEnabled();
  });
});
