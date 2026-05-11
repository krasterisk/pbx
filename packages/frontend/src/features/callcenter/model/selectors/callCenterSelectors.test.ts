import { describe, it, expect } from 'vitest';
import {
  selectCcAgents,
  selectCcQueues,
  selectCcCalls,
  selectCcConnected,
  selectMyAgent,
  selectMyAgentInterface,
  selectWaitingCalls,
  selectActiveCalls,
  selectTotalWaiting,
  selectAvailableAgents,
} from './callCenterSelectors';

const baseState = (over: any = {}) => ({
  callCenter: {
    agents: [],
    queues: [],
    calls: [],
    connected: false,
    myAgentInterface: null,
    ...over,
  },
}) as any;

describe('callCenterSelectors', () => {
  it('returns safe defaults when callCenter slice is absent', () => {
    const empty = {} as any;
    expect(selectCcAgents(empty)).toEqual([]);
    expect(selectCcQueues(empty)).toEqual([]);
    expect(selectCcCalls(empty)).toEqual([]);
    expect(selectCcConnected(empty)).toBe(false);
    expect(selectMyAgentInterface(empty)).toBeNull();
  });

  it('selectMyAgent returns undefined when no interface is set', () => {
    expect(selectMyAgent(baseState())).toBeUndefined();
  });

  it('selectMyAgent returns the agent matching myAgentInterface', () => {
    const state = baseState({
      myAgentInterface: 'PJSIP/101',
      agents: [
        { interface: 'PJSIP/100', name: 'Bob', status: 'READY' },
        { interface: 'PJSIP/101', name: 'Alice', status: 'PAUSED' },
      ],
    });
    expect(selectMyAgent(state)?.name).toBe('Alice');
  });

  it('selectWaitingCalls returns WAITING+RINGING calls only', () => {
    const state = baseState({
      calls: [
        { uniqueid: 'a', status: 'WAITING' },
        { uniqueid: 'b', status: 'TALKING' },
        { uniqueid: 'c', status: 'RINGING' },
        { uniqueid: 'd', status: 'HOLD' },
      ],
    });
    expect(selectWaitingCalls(state).map(c => c.uniqueid)).toEqual(['a', 'c']);
  });

  it('selectActiveCalls returns TALKING+HOLD calls only', () => {
    const state = baseState({
      calls: [
        { uniqueid: 'a', status: 'WAITING' },
        { uniqueid: 'b', status: 'TALKING' },
        { uniqueid: 'c', status: 'HOLD' },
      ],
    });
    expect(selectActiveCalls(state).map(c => c.uniqueid)).toEqual(['b', 'c']);
  });

  it('selectTotalWaiting sums the waiting field across queues', () => {
    const state = baseState({
      queues: [
        { name: 'a', waiting: 2 },
        { name: 'b', waiting: 5 },
        { name: 'c', waiting: 0 },
      ],
    });
    expect(selectTotalWaiting(state)).toBe(7);
  });

  it('selectAvailableAgents counts only READY agents', () => {
    const state = baseState({
      agents: [
        { status: 'READY' },
        { status: 'PAUSED' },
        { status: 'READY' },
        { status: 'IN_CALL' },
      ],
    });
    expect(selectAvailableAgents(state)).toBe(2);
  });
});
