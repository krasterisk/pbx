import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SupervisorAgentsBoard, type SupervisorAgentsBoardProps } from './SupervisorAgentsBoard';
import { SupervisorAgentStatusMenu } from './SupervisorAgentStatusMenu';
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';

vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, option?: string) => typeof option === 'string' ? option : key,
}) }));
const agent: IAgent = { interface: 'PJSIP/201', name: 'Synthetic Anna', userId: 1, userUid: 8,
  status: 'READY', queues: ['sales', 'corporate'], callsTaken: 500, callsMade: 300,
  kpiDay: { answered: 7, made: 3, missed: 2 } };
const handlers = () => ({ onStartShift: vi.fn(), onEndShift: vi.fn(), onPause: vi.fn(), onUnpause: vi.fn() });

describe('Pulse table and single status control', () => {
  it('shows separate reporting-day counters and a truncated queue list that opens queue management', () => {
    const onOpenQueues = vi.fn();
    const props: SupervisorAgentsBoardProps = {
      agents: [agent], watchedCount: 1, queues: [
        { name: 'sales', displayName: 'Sales' }, { name: 'corporate', displayName: 'Corporate customer support and partners' },
      ] as IQueueStats[], calls: [], pauseReasons: [], density: 'table', onDensityChange: vi.fn(),
      groupBy: 'none', onGroupByChange: vi.fn(), sortBy: 'name', onSortByChange: vi.fn(),
      showActiveOnly: false, onShowActiveOnlyChange: vi.fn(), rowSelection: {}, onRowSelectionChange: vi.fn(),
      agentAvatarSrc: () => undefined, agentActivity: () => ({ text: 'Ready' }), renderElapsed: () => '00:01',
      onOpenWatchlist: vi.fn(), onOpenAgent: vi.fn(), onOpenQueues, onSpy: vi.fn(), onRemoveAgent: vi.fn(), ...handlers(),
    };
    render(<SupervisorAgentsBoard {...props} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryByRole('columnheader', { name: 'Calls' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Inbound' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Outbound' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic Anna')).toBeInTheDocument();
    expect(screen.getByText('callcenter.supervisor.pulse.extension')).toBeInTheDocument();
    expect(screen.queryByText('callcenter.supervisor.pulse.tableHint')).not.toBeInTheDocument();
    expect(screen.queryByText('500')).not.toBeInTheDocument();
    const queues = screen.getByRole('button', { name: 'callcenter.supervisor.pulse.manageQueuesFor' });
    expect(Array.from(queues.textContent ?? '')).toHaveLength(32);
    expect(queues).toHaveTextContent('…');
    fireEvent.click(queues);
    expect(onOpenQueues).toHaveBeenCalledWith(agent);
    fireEvent.click(screen.getByTestId('supervisor-manage-watchlist'));
    expect(props.onOpenWatchlist).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('supervisor-status-chips')).not.toBeInTheDocument();
  });

  it('offers pause and shift actions under one keyboard-accessible menu', async () => {
    const actions = handlers();
    render(<SupervisorAgentStatusMenu agent={agent} {...actions} />);
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const pause = await screen.findByRole('menuitem', { name: 'Pause' });
    fireEvent.click(pause);
    await waitFor(() => expect(actions.onPause).toHaveBeenCalledWith(agent));
    expect(actions.onEndShift).not.toHaveBeenCalled();
  });

  it('keeps automatic call states read-only while permitting a confirmed shift-end request', async () => {
    const actions = handlers();
    render(<SupervisorAgentStatusMenu agent={{ ...agent, status: 'IN_CALL' }} {...actions} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Pause' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'End shift' }));
    expect(actions.onEndShift).toHaveBeenCalledTimes(1);
    expect(actions.onPause).not.toHaveBeenCalled();
  });

  it('shows a human-readable automatic pause reason instead of the engine code', () => {
    render(<SupervisorAgentStatusMenu agent={{ ...agent, status: 'PAUSED', pauseReason: 'auto_pause:rona' }} {...handlers()} />);
    expect(screen.getByText(/Auto-pause: no answer/)).toBeInTheDocument();
    expect(screen.queryByText(/auto_pause:rona/)).not.toBeInTheDocument();
  });
});
