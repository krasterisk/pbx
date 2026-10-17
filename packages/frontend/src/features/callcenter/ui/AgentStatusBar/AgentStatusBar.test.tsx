import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
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
