import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ICall } from '../../model/types/callCenterSchema';
import { LiveDuration } from './LiveDuration';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const ago = (sec: number) => new Date(NOW.getTime() - sec * 1000).toISOString();

const call = (partial: Partial<ICall>): ICall => ({
  uniqueid: 'u1',
  callerIdNum: '7999',
  callerIdName: '',
  queue: 'sales',
  status: 'WAITING',
  enterTime: ago(30),
  holdTime: 0,
  talkTime: 0,
  userUid: 1,
  ...partial,
});

describe('LiveDuration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks the wait of a pending call and flags it past the limit', () => {
    render(<LiveDuration call={call({})} kind="wait" limitSec={40} />);
    const el = screen.getByTestId('live-wait-u1');
    expect(el).toHaveTextContent('0:30');
    expect(el).toHaveAttribute('data-over', 'false');

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(el).toHaveTextContent('0:45');
    expect(el).toHaveAttribute('data-over', 'true');
  });

  it('freezes the wait of an answered call at the answer moment', () => {
    render(
      <LiveDuration
        call={call({ status: 'TALKING', enterTime: ago(100), answerTime: ago(70) })}
        kind="wait"
      />,
    );
    expect(screen.getByTestId('live-wait-u1')).toHaveTextContent('0:30');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('live-wait-u1')).toHaveTextContent('0:30');
  });

  it('ticks talk time for conversations and shows a dash for callers still waiting', () => {
    const { rerender } = render(
      <LiveDuration call={call({ status: 'TALKING', answerTime: ago(125) })} kind="talk" />,
    );
    expect(screen.getByTestId('live-talk-u1')).toHaveTextContent('2:05');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('live-talk-u1')).toHaveTextContent('2:10');

    rerender(<LiveDuration call={call({ status: 'WAITING' })} kind="talk" />);
    expect(screen.getByTestId('live-talk-u1')).toHaveTextContent('—');
  });
});
