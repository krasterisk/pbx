import { describe, it, expect } from 'vitest';
import type { ICall } from '../model/types/callCenterSchema';
import {
  callTalkSec,
  callWaitSec,
  formatClock,
  isActiveCall,
  isPendingCall,
  longestWaitSec,
  sortLiveCalls,
} from './liveCallTiming';

const NOW = new Date('2026-07-15T12:00:00.000Z').getTime();
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

function call(partial: Partial<ICall>): ICall {
  return {
    uniqueid: 'u',
    callerIdNum: '79990000000',
    callerIdName: '',
    queue: 'sales',
    status: 'WAITING',
    enterTime: ago(0),
    holdTime: 0,
    talkTime: 0,
    userUid: 1,
    ...partial,
  };
}

describe('liveCallTiming', () => {
  it('classifies pending and active calls', () => {
    expect(isPendingCall(call({ status: 'WAITING' }))).toBe(true);
    expect(isPendingCall(call({ status: 'RINGING' }))).toBe(true);
    expect(isPendingCall(call({ status: 'TALKING' }))).toBe(false);
    expect(isActiveCall(call({ status: 'HOLD' }))).toBe(true);
    expect(isActiveCall(call({ status: 'WAITING' }))).toBe(false);
  });

  it('wait ticks for pending calls and freezes at the answer moment', () => {
    expect(callWaitSec(call({ status: 'WAITING', enterTime: ago(75) }), NOW)).toBe(75);
    expect(callWaitSec(call({ status: 'RINGING', enterTime: ago(8) }), NOW)).toBe(8);
    const answered = call({ status: 'TALKING', enterTime: ago(100), answerTime: ago(70) });
    expect(callWaitSec(answered, NOW)).toBe(30);
    expect(callWaitSec(answered, NOW + 600_000)).toBe(30);
  });

  it('never returns a negative or NaN wait', () => {
    expect(callWaitSec(call({ enterTime: new Date(NOW + 5000).toISOString() }), NOW)).toBe(0);
    expect(callWaitSec(call({ enterTime: 'garbage' }), NOW)).toBe(0);
    expect(callWaitSec(call({ status: 'TALKING', enterTime: ago(10) }), NOW)).toBe(0);
  });

  it('talk time runs from the answer for active calls only', () => {
    expect(callTalkSec(call({ status: 'TALKING', answerTime: ago(125) }), NOW)).toBe(125);
    expect(callTalkSec(call({ status: 'HOLD', answerTime: ago(40) }), NOW)).toBe(40);
    expect(callTalkSec(call({ status: 'WAITING' }), NOW)).toBe(0);
    expect(callTalkSec(call({ status: 'TALKING', talkTime: 33 }), NOW)).toBe(33);
  });

  it('longest wait considers only waiting callers and optionally one queue', () => {
    const calls = [
      call({ uniqueid: 'a', queue: 'sales', enterTime: ago(20) }),
      call({ uniqueid: 'b', queue: 'support', enterTime: ago(90) }),
      call({ uniqueid: 'c', queue: 'sales', status: 'RINGING', enterTime: ago(500) }),
      call({ uniqueid: 'd', queue: 'sales', status: 'TALKING', enterTime: ago(900), answerTime: ago(10) }),
    ];
    expect(longestWaitSec(calls, NOW)).toBe(90);
    expect(longestWaitSec(calls, NOW, 'SALES')).toBe(20);
    expect(longestWaitSec(calls, NOW, 'none')).toBe(0);
    expect(longestWaitSec([], NOW)).toBe(0);
  });

  it('orders the longest waiting caller first, then ringing, then longest conversations', () => {
    const sorted = sortLiveCalls([
      call({ uniqueid: 'talk-short', status: 'TALKING', enterTime: ago(50), answerTime: ago(20) }),
      call({ uniqueid: 'wait-short', enterTime: ago(10) }),
      call({ uniqueid: 'ring', status: 'RINGING', enterTime: ago(3) }),
      call({ uniqueid: 'talk-long', status: 'HOLD', enterTime: ago(500), answerTime: ago(400) }),
      call({ uniqueid: 'wait-long', enterTime: ago(80) }),
    ]).map((c) => c.uniqueid);
    expect(sorted).toEqual(['wait-long', 'wait-short', 'ring', 'talk-long', 'talk-short']);
  });

  it('does not mutate the input array', () => {
    const input = [call({ uniqueid: 'x', enterTime: ago(1) }), call({ uniqueid: 'y', enterTime: ago(9) })];
    sortLiveCalls(input);
    expect(input.map((c) => c.uniqueid)).toEqual(['x', 'y']);
  });

  it('formats clocks as m:ss and h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3599)).toBe('59:59');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(7322)).toBe('2:02:02');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});
