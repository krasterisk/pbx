import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { SupervisorCallsPanel, type SupervisorCallsPanelProps } from './SupervisorCallsPanel';

vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, fallback?: string) => fallback || key,
}) }));
const call = (id: string, agent: string): ICall => ({
  uniqueid: id, agent, callerIdNum: '7999', callerIdName: '', queue: 'q700_7',
  status: 'TALKING', enterTime: new Date().toISOString(), answerTime: new Date().toISOString(),
  holdTime: 0, talkTime: 0, userUid: 7,
});
function props(): SupervisorCallsPanelProps {
  return { calls: [call('a', 'PJSIP/e101_7'), call('b', 'PJSIP/e102_7')], agents: [], queues: [], readyAgents: [],
    transferOptions: [{ value: 'PJSIP/e102_7', label: 'Bob', group: 'agent' }], maxWaitSec: 30,
    waitingCount: 0, talkingCount: 2, freeAgentsCount: 0, collapsed: false,
    onToggleCollapsed: vi.fn(), onRedirect: vi.fn(), onSpy: vi.fn(), onRequestHangup: vi.fn() };
}

describe('independent supervisor call rows', () => {
  it('uses the latest action callback even when unchanged rows are memoized', async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(<SupervisorCallsPanel {...initial} />);
    const onSpy = vi.fn();
    view.rerender(<SupervisorCallsPanel {...initial} onSpy={onSpy} />);
    await user.click(screen.getByTestId('call-spy-a'));
    expect(onSpy).toHaveBeenCalledWith('PJSIP/e101_7');
    expect(initial.onSpy).not.toHaveBeenCalled();
  });

  it('keeps an open transfer search while another call changes and sends the current command', async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(<SupervisorCallsPanel {...initial} />);
    await user.click(screen.getByTestId('call-transfer-a'));
    const search = screen.getByTestId('call-transfer-a-search');
    await user.type(search, 'Bob');
    const onRedirect = vi.fn();
    view.rerender(<SupervisorCallsPanel {...initial} calls={[initial.calls[0], { ...initial.calls[1], status: 'HOLD' }]}
      transferOptions={initial.transferOptions.map(option => ({ ...option }))} onRedirect={onRedirect} />);
    expect(screen.getByTestId('call-transfer-a-search')).toBe(search);
    expect(search).toHaveValue('Bob');
    expect(screen.getByTestId('supervisor-call-row-b')).toHaveAttribute('data-status', 'HOLD');
    await user.click(screen.getByTestId('call-transfer-a-option-PJSIP/e102_7'));
    expect(onRedirect).toHaveBeenCalledWith(initial.calls[0], 'PJSIP/e102_7');
    expect(initial.onRedirect).not.toHaveBeenCalled();
  });
});
