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

const play = vi.hoisted(() => vi.fn());
vi.mock('../../lib/useAttentionSound', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/useAttentionSound')>();
  return {
    ...original,
    useAttentionSound: (items: never, enabled: boolean) => original.useAttentionSound(items, enabled, play),
  };
});

import type { IAgent, ICall, IQueueStats } from '../../model/types/callCenterSchema';
import { DEFAULT_KPI_THRESHOLDS } from '../../lib/kpiThresholds';
import { AttentionFeed, ATTENTION_VISIBLE_ROWS, type AttentionFeedProps } from './AttentionFeed';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const ago = (sec: number) => new Date(NOW.getTime() - sec * 1000).toISOString();

const queue: IQueueStats = {
  name: 'sales',
  displayName: 'Sales',
  strategy: 'rrmemory',
  waiting: 1,
  talking: 0,
  agents: { total: 4, available: 2, paused: 1, busy: 1 },
  sla: 95,
  calls: { answered: 20, abandoned: 1, total: 22, shortAbandoned: 1 },
  avgWait: 10,
  avgTalk: 100,
  userUid: 1,
};

const agent = (partial: Partial<IAgent> = {}): IAgent => ({
  interface: 'PJSIP/100',
  name: 'Anna',
  status: 'READY',
  queues: ['sales'],
  callsTaken: 0,
  userUid: 1,
  userId: 10,
  ...partial,
});

const waitingCall = (sec: number): ICall => ({
  uniqueid: 'w1',
  callerIdNum: '7999',
  callerIdName: '',
  queue: 'sales',
  status: 'WAITING',
  enterTime: ago(sec),
  holdTime: 0,
  talkTime: 0,
  userUid: 1,
});

function props(partial: Partial<AttentionFeedProps> = {}): AttentionFeedProps {
  return {
    agents: [],
    queues: [queue],
    calls: [],
      pauseReasons: [{ name: 'Lunch', max_duration: 10 }],
    thresholds: { ...DEFAULT_KPI_THRESHOLDS },
    soundEnabled: true,
    queueLabel: (name) => name.toUpperCase(),
    onUnpause: vi.fn(),
    onSpy: vi.fn(),
    onOpenQueue: vi.fn(),
    ...partial,
  };
}

describe('AttentionFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    play.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the calm state when nothing needs attention', () => {
    render(<AttentionFeed {...props()} />);
    expect(screen.getByTestId('attention-feed')).toHaveAttribute('data-state', 'ok');
    expect(screen.getByText(/No alerts/)).toBeInTheDocument();
  });

  it('scenario: a paused agent past the limit appears and Resume unpauses them without leaving the page', () => {
    const p = props({
      agents: [agent({ status: 'PAUSED', pauseReason: 'Lunch', statusSince: ago(1500) })],
    });
    render(<AttentionFeed {...p} />);

    const row = screen.getByTestId('attention-item-pause_over:PJSIP/100');
    expect(row).toHaveAttribute('data-severity', 'critical');
    expect(row).toHaveTextContent('Anna: on pause 25:00 (limit 10:00)');

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(p.onUnpause).toHaveBeenCalledWith('PJSIP/100');
  });

  it('a long-waiting caller opens the queue; the message uses the queue label', () => {
    const p = props({ calls: [waitingCall(90)] });
    render(<AttentionFeed {...p} />);

    expect(screen.getByTestId('attention-item-queue_wait:sales')).toHaveTextContent(
      'Queue SALES: caller waiting 1:30 (limit 1:00)',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open queue' }));
    expect(p.onOpenQueue).toHaveBeenCalledWith('sales');
  });

  it('keeps ticking: a waiter escalates from nothing to warning to critical with the clock', () => {
    render(<AttentionFeed {...props({ calls: [waitingCall(30)] })} />);
    expect(screen.getByTestId('attention-feed')).toHaveAttribute('data-state', 'ok');

    act(() => {
      vi.advanceTimersByTime(15_000); // 45 s = 75% of the limit
    });
    expect(screen.getByTestId('attention-item-queue_wait:sales')).toHaveAttribute('data-severity', 'warning');

    act(() => {
      vi.advanceTimersByTime(20_000); // 65 s > limit
    });
    expect(screen.getByTestId('attention-item-queue_wait:sales')).toHaveAttribute('data-severity', 'critical');
  });

  it('beeps for a newly critical item only when sound is enabled and announces it to assertive live region (U0.6)', () => {
    const { rerender } = render(<AttentionFeed {...props()} />);
    expect(play).not.toHaveBeenCalled();

    rerender(<AttentionFeed {...props({ calls: [waitingCall(120)] })} />);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cc-live-assertive')).toHaveTextContent(
      'Queue SALES: caller waiting 2:00 (limit 1:00)',
    );
  });

  it('stays silent when alert_sound_enabled is off', () => {
    const { rerender } = render(<AttentionFeed {...props({ soundEnabled: false })} />);
    rerender(<AttentionFeed {...props({ soundEnabled: false, calls: [waitingCall(120)] })} />);
    expect(play).not.toHaveBeenCalled();
  });

  it('folds long lists and expands them on demand', () => {
    const agents = Array.from({ length: ATTENTION_VISIBLE_ROWS + 3 }, (_, i) =>
      agent({ interface: `PJSIP/${i}`, name: `Agent ${i}`, status: 'READY', queuesDetached: true }),
    );
    render(<AttentionFeed {...props({ agents })} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(ATTENTION_VISIBLE_ROWS);
    expect(screen.getByTestId('attention-count')).toHaveTextContent(String(ATTENTION_VISIBLE_ROWS + 3));

    fireEvent.click(screen.getByTestId('attention-toggle'));
    expect(screen.getAllByRole('listitem')).toHaveLength(ATTENTION_VISIBLE_ROWS + 3);

    fireEvent.click(screen.getByTestId('attention-toggle'));
    expect(screen.getAllByRole('listitem')).toHaveLength(ATTENTION_VISIBLE_ROWS);
  });
});
