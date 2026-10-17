import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => {
      if (typeof arg === 'string') return arg;
      const template = String(arg?.defaultValue ?? key);
      return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(arg?.[name] ?? ''));
    },
  }),
}));

import type { ICall, IQueueStats } from '../../model/types/callCenterSchema';
import { DEFAULT_KPI_THRESHOLDS } from '../../lib/kpiThresholds';
import { QueueTiles, type QueueTilesProps } from './QueueTiles';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const ago = (sec: number) => new Date(NOW.getTime() - sec * 1000).toISOString();

const sales: IQueueStats = {
  name: 'sales',
  displayName: 'Sales',
  strategy: 'rrmemory',
  waiting: 2,
  talking: 1,
  agents: { total: 5, available: 2, paused: 1, busy: 2 },
  sla: 55,
  calls: { answered: 18, abandoned: 2, total: 21, shortAbandoned: 1 },
  avgWait: 12.4,
  avgTalk: 98.6,
  userUid: 1,
};

const idle: IQueueStats = {
  ...sales,
  name: 'support',
  displayName: 'Support',
  waiting: 0,
  sla: 0,
  calls: { answered: 0, abandoned: 0, total: 0 },
  avgWait: 0,
  avgTalk: 0,
};

const waiting = (uniqueid: string, queue: string, sec: number): ICall => ({
  uniqueid,
  callerIdNum: '7999',
  callerIdName: '',
  queue,
  status: 'WAITING',
  enterTime: ago(sec),
  holdTime: 0,
  talkTime: 0,
  userUid: 1,
});

function props(partial: Partial<QueueTilesProps> = {}): QueueTilesProps {
  return {
    queues: [sales, idle],
    calls: [],
    thresholds: { ...DEFAULT_KPI_THRESHOLDS },
    isQueueActive: () => false,
    queueLabel: (name) => name.toUpperCase(),
    onToggleQueue: vi.fn(),
    ...partial,
  };
}

describe('QueueTiles', () => {
  it('keeps ten compact queues available and exposes filtering as native pressed buttons', () => {
    const p = props({ layout: 'compact', queues: Array.from({ length: 10 }, (_, i) => ({ ...sales, name: `queue-${i}` })) });
    render(<QueueTiles {...p} />);
    const target = screen.getByTestId('queue-overview-queue-7');
    expect(target.tagName).toBe('BUTTON');
    expect(target).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(target);
    expect(p.onToggleQueue).toHaveBeenCalledWith('queue-7');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(10);
    expect(target).toHaveTextContent('55%');
    expect(screen.getByTestId('queue-overview-queue-0')).toBeVisible();
    expect(screen.getByTestId('queue-overview-queue-9')).toBeVisible();
  });
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the headline numbers of a busy queue with tenant-threshold tones', () => {
    render(<QueueTiles {...props({ calls: [waiting('a', 'sales', 75), waiting('b', 'sales', 20)] })} />);

    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveTextContent('1:15');
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveAttribute('data-tone', 'destructive');
    expect(screen.getByTestId('queue-tile-sla-sales')).toHaveTextContent('55%');
    expect(screen.getByTestId('queue-tile-sla-sales')).toHaveAttribute('data-tone', 'destructive');
    expect(screen.getByTestId('queue-tile-abandon-sales')).toHaveTextContent('10%');
    expect(screen.getByTestId('queue-tile-waiting-sales')).toHaveTextContent('In queue: 2');
    expect(screen.getByTestId('queue-tile-agents-sales')).toHaveTextContent('Ready 2 · busy 2 · paused 1');
    expect(screen.getByText('SALES')).toBeInTheDocument();
  });

  it('an idle queue shows "no data" instead of red zeros', () => {
    render(<QueueTiles {...props()} />);
    expect(screen.getByTestId('queue-tile-sla-support')).toHaveTextContent('—');
    expect(screen.getByTestId('queue-tile-sla-support')).toHaveAttribute('data-tone', 'default');
    expect(screen.getByTestId('queue-tile-abandon-support')).toHaveTextContent('—');
    expect(screen.getByTestId('queue-tile-longest-support')).toHaveTextContent('0:00');
  });

  it('the longest wait ticks every second without any store update', () => {
    render(<QueueTiles {...props({ calls: [waiting('a', 'sales', 50)] })} />);
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveTextContent('0:50');
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveAttribute('data-tone', 'warning');

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveTextContent('1:02');
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveAttribute('data-tone', 'destructive');
  });

  it('counts waiters per queue only', () => {
    render(<QueueTiles {...props({ calls: [waiting('a', 'support', 40)] })} />);
    expect(screen.getByTestId('queue-tile-longest-support')).toHaveTextContent('0:40');
    expect(screen.getByTestId('queue-tile-longest-sales')).toHaveTextContent('0:00');
  });

  it('click and keyboard toggle the queue filter; selected tile is pressed', () => {
    const p = props({ isQueueActive: (name) => name === 'sales' });
    render(<QueueTiles {...p} />);

    expect(screen.getByTestId('queue-tile-sales')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('queue-tile-support')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('queue-tile-support'));
    expect(p.onToggleQueue).toHaveBeenCalledWith('support');

    fireEvent.keyDown(screen.getByTestId('queue-tile-sales'), { key: 'Enter' });
    expect(p.onToggleQueue).toHaveBeenCalledWith('sales');
    expect(p.onToggleQueue).toHaveBeenCalledTimes(2);
  });

  describe('SLA trend of the last half hour', () => {
    it('shows level and change per queue, coloured by direction', () => {
      render(<QueueTiles {...props({ trends: { sales: { sla: 50, delta: -12.5, direction: 'down' } } })} />);
      const trend = screen.getByTestId('queue-tile-trend-sales');
      expect(trend).toHaveTextContent('Last 30 min: 50% (-12.5 pp)');
      expect(trend).toHaveAttribute('data-direction', 'down');
    });

    it('signs an improvement and shows only the level when there is nothing to compare', () => {
      render(
        <QueueTiles
          {...props({
            trends: {
              sales: { sla: 80, delta: 5, direction: 'up' },
              support: { sla: 90, delta: null, direction: 'flat' },
            },
          })}
        />,
      );
      expect(screen.getByTestId('queue-tile-trend-sales')).toHaveTextContent('(+5 pp)');
      expect(screen.getByTestId('queue-tile-trend-support')).toHaveTextContent('Last 30 min: 90%');
      expect(screen.getByTestId('queue-tile-trend-support')).not.toHaveTextContent('pp');
    });

    it('shows no trend for a queue without an entry, and none without data', () => {
      render(<QueueTiles {...props({ trends: { sales: { sla: 50, delta: 0, direction: 'flat' } } })} />);
      expect(screen.queryByTestId('queue-tile-trend-support')).not.toBeInTheDocument();
    });
  });

});
