import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const text = typeof fallback === 'string' ? fallback : key;
      const vars = (typeof fallback === 'object' ? fallback : opts) as Record<string, unknown> | undefined;
      return vars ? text.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k] ?? '')) : text;
    },
  }),
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetAgentKpiQuery: () => ({ data: undefined }),
}));

vi.mock('@/features/callcenter/ui/CallControlBar/CallControlBar', () => ({
  CallControlBar: () => null,
}));

import { AgentStatusBar } from './AgentStatusBar';

const baseAgent = (over: Partial<IAgent>): IAgent => ({
  interface: 'PJSIP/101',
  name: 'Anna',
  status: 'READY',
  queues: [],
  callsTaken: 5,
  callsMissed: 1,
  callsMade: 2,
  kpiDay: { answered: 12, made: 4, missed: 3 },
  ...over,
} as IAgent);

describe('AgentStatusBar (U2.6/U2.7)', () => {
  it('splits the header status from the metric row without duplicating either', () => {
    const view = render(<AgentStatusBar section="status" compact agent={baseAgent({})} queues={[]} shiftActions={{ isLoggedIn: true }} />);
    expect(screen.getByTestId('cc-agent-status-menu')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Shift counters' })).toBeNull();
    view.rerender(<AgentStatusBar section="metrics" compact agent={baseAgent({})} queues={[]} />);
    expect(screen.queryByTestId('cc-agent-status-menu')).toBeNull();
    expect(screen.getByRole('group', { name: 'Shift counters' })).toBeInTheDocument();
  });
  it('combines pause, outbound work and end shift in one status menu', async () => {
    const user = userEvent.setup(), onPause = vi.fn(), onEndShift = vi.fn(), onOutboundWorkChange = vi.fn();
    render(<AgentStatusBar agent={baseAgent({})} queues={[]} shiftActions={{ isLoggedIn: true, showPause: true, showOutboundWork: true, onPause, onEndShift, onOutboundWorkChange }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByTestId('cc-agent-status-menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('cc-agent-status-menu'));
    await user.click(screen.getByRole('menuitem', { name: 'callcenter.agent.outboundWork' }));
    expect(onOutboundWorkChange).toHaveBeenCalledWith(true);
    await user.click(screen.getByTestId('cc-agent-status-menu'));
    await user.click(screen.getByRole('menuitem', { name: 'callcenter.softphone.endShift' }));
    expect(onEndShift).toHaveBeenCalledTimes(1);
  });
  it('does not offer end shift when the lifecycle guard omits the action', async () => {
    const user = userEvent.setup();
    render(<AgentStatusBar agent={baseAgent({ status: 'WRAPUP' })} queues={[]} shiftActions={{ isLoggedIn: true }} />);
    await user.click(screen.getByTestId('cc-agent-status-menu'));
    expect(screen.getByRole('menuitem', { name: 'callcenter.softphone.endShift' })).toHaveAttribute('aria-disabled', 'true');
  });
  it('shows one number per KPI (the shift value) with the day value only in the tooltip', () => {
    render(<AgentStatusBar agent={baseAgent({})} queues={[]} kpiDisplay="shift" />);
    const answered = screen.getByTestId('kpi-Answered');
    expect(answered).toHaveTextContent('5');
    expect(answered).not.toHaveTextContent('12');
    expect(answered).toHaveAttribute('title', expect.stringContaining('12'));
  });

  const pausedAgent = (secondsAgo: number) =>
    baseAgent({
      status: 'PAUSED',
      pauseReason: 'Lunch',
      statusSince: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    });

  it('warns in the last minute of a pause limit', () => {
    render(<AgentStatusBar agent={pausedAgent(9 * 60 + 5)} queues={[]} pauseLimitMin={10} />);
    const timer = screen.getByTestId('pause-limit-timer');
    expect(timer).toHaveAttribute('data-level', 'warn');
    expect(timer).toHaveTextContent('09:05 of 10:00');
  });

  it('shows "over limit" after the limit is exceeded', () => {
    render(<AgentStatusBar agent={pausedAgent(10 * 60 + 30)} queues={[]} pauseLimitMin={10} />);
    const timer = screen.getByTestId('pause-limit-timer');
    expect(timer).toHaveAttribute('data-level', 'over');
    expect(timer).toHaveTextContent('over limit +00:30');
  });

  it('has no limit timer for a pause without a limit', () => {
    render(<AgentStatusBar agent={pausedAgent(120)} queues={[]} pauseLimitMin={0} />);
    expect(screen.queryByTestId('pause-limit-timer')).not.toBeInTheDocument();
  });
});
